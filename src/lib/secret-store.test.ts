import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

/**
 * stronghold 与 fs 均为 Tauri 原生能力，这里用内存实现替代，
 * 重点验证水合竞态、迁移幂等与写入失败可见性这些纯逻辑。
 */
const secretRecords = new Map<string, Uint8Array>();
const plainRecords = new Map<string, unknown>();

let saveShouldFail = false;
let getShouldFail = false;
let resolveGate: (() => void) | null = null;

// 记录 loadClient/createClient 的调用序列与抛错行为，用于验证网页重载路径。
let loadClientError: Error | null = null;
const clientCalls: string[] = [];
// 记录实际落盘写入，用于断言水合不产生多余的回写。
const writeCalls: string[] = [];
// 记录快照保存次数与并发解密次数：两者都是约 600ms 的固定开销。
let saveCount = 0;
let loadSnapshotCount = 0;
// 让 save() 可以人为拖长，用于验证并发写入被合并成更少的保存。
let saveDelayMs = 0;

const storeMock = {
    get: async (key: string) => {
        if (getShouldFail) {
            throw new Error("stronghold read failed");
        }

        // 允许测试精确控制水合完成时机。
        if (resolveGate) {
            await new Promise<void>((resolve) => {
                resolveGate = resolve;
            });
        }

        return secretRecords.get(key) ?? null;
    },
    insert: async (key: string, value: number[]) => {
        writeCalls.push(key);
        secretRecords.set(key, Uint8Array.from(value));
    },
    remove: async (key: string) => {
        writeCalls.push(key);
        secretRecords.delete(key);
        return null;
    },
};

/**
 * 真实行为建模：createClient 得到的是一个全新的空客户端，它会顶替内存中
 * 已加载的客户端，后续 save() 就把空状态写回快照。这里用独立的空 store 表示，
 * 从而让「重载时误新建客户端」在测试中表现为凭据丢失。
 */
const emptyStoreMock = {
    get: async () => null,
    insert: async () => undefined,
    remove: async () => null,
};

vi.mock("@tauri-apps/plugin-stronghold", () => ({
    // new Client(path, name) 只是一个按名字寻址的句柄，仍指向已加载的真实 store。
    Client: class {
        constructor(
            public path: string,
            public name: string,
        ) {
            clientCalls.push("new Client");
        }

        getStore() {
            return storeMock;
        }
    },
    Stronghold: {
        load: async () => ({
            __loadCounted: (loadSnapshotCount += 1),
            loadClient: async () => {
                clientCalls.push("loadClient");

                if (loadClientError) {
                    throw loadClientError;
                }

                return { getStore: () => storeMock };
            },
            createClient: async () => {
                clientCalls.push("createClient");
                return { getStore: () => emptyStoreMock };
            },
            save: async () => {
                saveCount += 1;

                if (saveDelayMs > 0) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, saveDelayMs),
                    );
                }

                if (saveShouldFail) {
                    throw new Error("stronghold save failed");
                }
            },
        }),
    },
}));

vi.mock("@tauri-apps/api/path", () => ({
    appLocalDataDir: async () => "/tmp/gmm-test",
    join: async (...parts: string[]) => parts.join("/"),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
    exists: async () => true,
    readTextFile: async () => "a".repeat(64),
    writeTextFile: async () => undefined,
}));

vi.mock("@/lib/persistent-store", () => ({
    PersistentStore: {
        get: async (key: string, fallback: unknown) =>
            plainRecords.has(key) ? plainRecords.get(key) : fallback,
        set: async (key: string, value: unknown) => {
            plainRecords.set(key, value);
        },
    },
}));

const { SecretStore } = await import("./secret-store");

/**
 * secret-store 在模块作用域缓存 client 与 ref，需要全新状态的用例
 * 必须重新 import 一份模块实例。
 */
async function freshModule() {
    vi.resetModules();
    return (await import("./secret-store")).SecretStore;
}

beforeEach(() => {
    secretRecords.clear();
    plainRecords.clear();
    saveShouldFail = false;
    getShouldFail = false;
    resolveGate = null;
    loadClientError = null;
    clientCalls.length = 0;
    writeCalls.length = 0;
    saveCount = 0;
    loadSnapshotCount = 0;
    saveDelayMs = 0;
});

afterEach(() => {
    vi.restoreAllMocks();
});

async function flush() {
    for (let index = 0; index < 8; index += 1) {
        await nextTick();
        await Promise.resolve();
    }
}

/** 等待防抖写入落盘完成。 */
async function flushPersist(key: string) {
    await flush();
    await SecretStore.flush(key);
    await flush();
}

describe("SecretStore 读写", () => {
    it("写入后可以读回", async () => {
        await SecretStore.set("agentApiKey", "sk-secret");

        expect(await SecretStore.get("agentApiKey")).toBe("sk-secret");
    });

    it("写入空值等同于删除", async () => {
        await SecretStore.set("agentApiKey", "sk-secret");
        await SecretStore.set("agentApiKey", "");

        expect(await SecretStore.get("agentApiKey")).toBe("");
    });

    it("save 失败时抛出，不静默丢失", async () => {
        saveShouldFail = true;

        await expect(
            SecretStore.set("agentApiKey", "sk-secret"),
        ).rejects.toThrow(/save failed/u);
    });

    it("读取失败时 get 抛出而非返回空串", async () => {
        getShouldFail = true;

        await expect(SecretStore.get("agentApiKey")).rejects.toThrow(
            /read failed/u,
        );
    });

    it("getSafe 在读取失败时返回空串", async () => {
        getShouldFail = true;

        expect(await SecretStore.getSafe("agentApiKey")).toBe("");
    });
});

describe("SecretStore.useValue", () => {
    it("水合后填入已保存的值", async () => {
        await SecretStore.set("agentApiKey", "sk-existing");

        const state = SecretStore.useValue("agentApiKey");
        await flush();

        expect(state.value).toBe("sk-existing");
    });

    it("同一 key 返回同一个共享 ref", () => {
        const first = SecretStore.useValue("sharedKey");
        const second = SecretStore.useValue("sharedKey");

        expect(first).toBe(second);
    });

    it("修改后写入加密存储", async () => {
        const state = SecretStore.useValue("agentApiKey");
        await flush();

        state.value = "sk-new";
        await flushPersist("agentApiKey");

        expect(await SecretStore.get("agentApiKey")).toBe("sk-new");
    });

    it("quitApplication 场景：flushAll 会把仍在防抖期内的输入立即落盘", async () => {
        const state = SecretStore.useValue("quitFlushKey");
        await flush();

        state.value = "sk-typed-right-before-quit";
        // watch 默认异步触发，先等 nextTick 让防抖定时器注册上，再模拟用户刚输入完就点击退出。
        await nextTick();
        await SecretStore.flushAll();

        expect(await SecretStore.get("quitFlushKey")).toBe(
            "sk-typed-right-before-quit",
        );
    });

    it("连续输入只落盘最终值", async () => {
        const state = SecretStore.useValue("typingKey");
        await flush();

        state.value = "sk-";
        state.value = "sk-a";
        state.value = "sk-ab";
        state.value = "sk-abc";
        await flushPersist("typingKey");

        expect(await SecretStore.get("typingKey")).toBe("sk-abc");
    });

    it("水合完成前的用户输入不会被旧值覆盖，且会被保存", async () => {
        await SecretStore.set("racedKey", "sk-old");

        // 卡住读取，模拟用户在水合完成前就输入了新值。
        resolveGate = () => undefined;
        const state = SecretStore.useValue("racedKey");

        state.value = "sk-typed-by-user";

        const release = resolveGate;
        resolveGate = null;
        release?.();
        await flushPersist("racedKey");

        expect(state.value).toBe("sk-typed-by-user");
        expect(await SecretStore.get("racedKey")).toBe("sk-typed-by-user");
    });
});

describe("加载与保存开销", () => {
    it("多个 key 只解密快照一次", async () => {
        const store = await freshModule();

        await Promise.all([
            store.get("agentApiKey"),
            store.get("glossModKey"),
            store.get("nexusModsToken"),
        ]);

        // 解密约 600ms，绝不能每个 key 付一次。
        expect(loadSnapshotCount).toBe(1);
        expect(clientCalls.filter((c) => c === "loadClient")).toHaveLength(1);
    });

    it("prewarm 会立即开始解密，而不是等到首次读取", async () => {
        const store = await freshModule();

        // 关键：prewarm 是同步返回的，但必须已经把解密工作排出去了。
        // 这样这 ~600ms 才能和启动阶段的其他初始化重叠。
        store.prewarm();
        await flush();

        expect(loadSnapshotCount).toBe(1);

        // 预热后的读取复用同一个 client，不再重复解密。
        await store.get("agentApiKey");
        expect(loadSnapshotCount).toBe(1);
    });

    it("并发写入被合并成更少的快照保存", async () => {
        const store = await freshModule();

        // 先建立 client，避免把初始化算进来。
        await store.get("agentApiKey");
        saveCount = 0;

        // 保存耗时长（真实约 600ms），期间到达的写入应当被合并。
        saveDelayMs = 20;
        await Promise.all([
            store.set("k1", "v1"),
            store.set("k2", "v2"),
            store.set("k3", "v3"),
        ]);

        // 逐个保存会是 3 次；合并后应当明显更少。
        expect(saveCount).toBeLessThan(3);

        // 关键：合并不能丢数据，三个值都必须落盘。
        expect(await store.get("k1")).toBe("v1");
        expect(await store.get("k2")).toBe("v2");
        expect(await store.get("k3")).toBe("v3");
    });

    it("合并保存后写入的值仍会被持久化", async () => {
        const store = await freshModule();
        await store.get("agentApiKey");

        // 一次保存正在进行时到达的写入，必须再排一次保存，不能被吞掉。
        saveDelayMs = 20;
        const first = store.set("early", "1");
        await new Promise((resolve) => setTimeout(resolve, 5));
        const second = store.set("late", "2");

        await Promise.all([first, second]);

        expect(await store.get("early")).toBe("1");
        expect(await store.get("late")).toBe("2");
    });
});

describe("网页重载后复用已加载的客户端", () => {
    it("loadClient 报「已加载过」时复用现有客户端，而不是新建空客户端", async () => {
        secretRecords.set(
            "agentApiKey",
            new TextEncoder().encode("sk-persisted"),
        );

        const store = await freshModule();
        loadClientError = new Error(
            'client with id ClientId(abc) has already been loaded before, can not be loaded twice',
        );

        // 关键断言：必须走 new Client 复用，凭据仍读得到。
        expect(await store.get("agentApiKey")).toBe("sk-persisted");
        expect(clientCalls).toContain("new Client");
        expect(clientCalls).not.toContain("createClient");
    });

    it("快照中确实没有客户端时才新建", async () => {
        const store = await freshModule();
        loadClientError = new Error("error loading client data; no data present");

        expect(await store.get("agentApiKey")).toBe("");
        expect(clientCalls).toContain("createClient");
    });

    it("未知错误（如解密失败）直接抛出，不用空客户端顶替", async () => {
        const store = await freshModule();
        loadClientError = new Error("failed to decrypt snapshot");

        await expect(store.get("agentApiKey")).rejects.toThrow(/decrypt/u);
        expect(clientCalls).not.toContain("createClient");
    });
});

describe("水合不会把已存凭据覆盖成空", () => {
    it("水合读到的值不会被当成用户输入而回写", async () => {
        const store = await freshModule();
        secretRecords.set("agentApiKey", new TextEncoder().encode("sk-stored"));

        const state = store.useValue("agentApiKey");
        await store.ready("agentApiKey");
        await flush();
        await store.flush("agentApiKey");

        expect(state.value).toBe("sk-stored");
        expect(await store.get("agentApiKey")).toBe("sk-stored");
        // 关键断言：纯水合不得产生任何写入。每次启动都回写一遍，
        // 意味着任何一次读取异常都会被立刻放大成对磁盘凭据的覆盖。
        expect(writeCalls).toEqual([]);
    });

    it("读取失败后不主动落盘，磁盘上的凭据保持原样", async () => {
        const store = await freshModule();
        secretRecords.set("agentApiKey", new TextEncoder().encode("sk-stored"));

        getShouldFail = true;
        const state = store.useValue("agentApiKey");
        await store.ready("agentApiKey");
        await flush();
        await store.flush("agentApiKey");

        // 水合失败时内存是空串，但不能因此写盘——否则真实凭据会被清掉。
        expect(state.value).toBe("");
        expect(writeCalls).toEqual([]);

        getShouldFail = false;
        expect(await store.get("agentApiKey")).toBe("sk-stored");
    });

    it("读取失败后用户主动输入的新值仍能保存", async () => {
        const store = await freshModule();
        secretRecords.set("agentApiKey", new TextEncoder().encode("sk-stored"));

        getShouldFail = true;
        const state = store.useValue("agentApiKey");
        await store.ready("agentApiKey");
        await flush();

        getShouldFail = false;
        state.value = "sk-user-typed";
        await flush();
        await store.flush("agentApiKey");

        expect(await store.get("agentApiKey")).toBe("sk-user-typed");
    });
});

describe("SecretStore 明文迁移", () => {
    it("把明文旧值迁移到加密存储并清除明文", async () => {
        plainRecords.set("agentApiKey", "sk-legacy");

        const state = SecretStore.useValue("migrateKey", "agentApiKey");
        await SecretStore.ready("migrateKey");
        await flush();

        expect(state.value).toBe("sk-legacy");
        expect(await SecretStore.get("migrateKey")).toBe("sk-legacy");
        expect(plainRecords.get("agentApiKey")).toBe("");
    });

    it("迁移只执行一次，不会在明文清空后覆盖成空值", async () => {
        plainRecords.set("agentApiKey", "sk-legacy");

        const first = SecretStore.useValue("onceKey", "agentApiKey");
        await SecretStore.ready("onceKey");
        await flush();
        expect(first.value).toBe("sk-legacy");

        // 模拟重启：清掉共享 ref 缓存的影响，用新 key 复用同一 legacyKey。
        const migratedFlag = plainRecords.get(
            "secretsMigratedToStronghold:agentApiKey",
        );
        expect(migratedFlag).toBe(true);

        const second = SecretStore.useValue("otherKey", "agentApiKey");
        await SecretStore.ready("otherKey");
        await flush();

        // 明文已清空且标记已落，不应再迁移出空值覆盖既有凭据。
        expect(second.value).toBe("");
        expect(await SecretStore.get("onceKey")).toBe("sk-legacy");
    });
});

describe("SecretStore.migrateLegacyJsonField", () => {
    it("抽出嵌套字段并清空明文中的密钥", async () => {
        plainRecords.set("nexusModsUser", {
            name: "tester",
            key: "nexus-token",
        });

        await SecretStore.migrateLegacyJsonField<{ key: string }>(
            "nexusModsToken",
            "nexusModsUser",
            "key",
        );

        expect(await SecretStore.get("nexusModsToken")).toBe("nexus-token");
        expect(plainRecords.get("nexusModsUser")).toEqual({
            name: "tester",
            key: "",
        });
    });

    it("失败时不落迁移标记，便于下次重试", async () => {
        plainRecords.set("nexusModsUser", { key: "nexus-token" });
        saveShouldFail = true;

        await SecretStore.migrateLegacyJsonField<{ key: string }>(
            "nexusModsToken",
            "nexusModsUser",
            "key",
        );

        expect(
            plainRecords.get("secretsMigratedToStronghold:nexusModsUser"),
        ).toBeUndefined();
        // 明文未被破坏，凭据仍可恢复。
        expect(plainRecords.get("nexusModsUser")).toEqual({
            key: "nexus-token",
        });
    });
});

describe("SecretStore.ready", () => {
    it("等待首次水合完成后才返回", async () => {
        await SecretStore.set("readyKey", "sk-stored");

        const state = SecretStore.useValue("readyKey");

        // 水合是异步的，立即读取还是空值。
        expect(state.value).toBe("");

        await SecretStore.ready("readyKey");

        // ready() 返回后必须已拿到真实凭据，下游才能正确判断“是否已配置”。
        expect(state.value).toBe("sk-stored");
    });

    it("对未使用过的 key 不报错", async () => {
        await expect(
            SecretStore.ready("neverUsedKey"),
        ).resolves.toBeUndefined();
    });
});
