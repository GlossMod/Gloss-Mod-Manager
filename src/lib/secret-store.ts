import { Client, Stronghold } from "@tauri-apps/plugin-stronghold";
import type { ClientPath } from "@tauri-apps/plugin-stronghold";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { ElMessage } from "element-plus-message";
import { ref, watch } from "vue";
import type { Ref } from "vue";
import { PersistentStore } from "@/lib/persistent-store";

/**
 * 凭据（AI API Key、GlossMod Key、NexusMods Token）此前明文存放在 settings.json，
 * 任何能读到该文件的进程都可以直接拿走。这里改为写入 stronghold 加密快照。
 *
 * stronghold 快照需要一个口令，而应用没有主密码交互；因此在应用本地数据目录生成
 * 一份随机设备密钥文件作为口令来源。这不能防御「攻击者已能以当前用户身份任意读文件」
 * 的场景，但可以让凭据不再以明文形式散落在配置文件里，并把密钥收敛到单个文件便于加固。
 */

const SNAPSHOT_FILE_NAME = "secrets.stronghold";
const DEVICE_KEY_FILE_NAME = "secrets-device-key.txt";
const CLIENT_NAME = "gloss-mod-manager-secrets";
const MIGRATED_FLAG_PREFIX = "secretsMigratedToStronghold";
// stronghold 每次 save 都要重写加密快照，逐字符保存开销大且可能乱序，这里做防抖。
const PERSIST_DEBOUNCE_MS = 400;

let clientPromise: Promise<Client> | null = null;
let strongholdInstance: Stronghold | null = null;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// 同一 key 只保留一个共享 ref，避免多处 useValue 拿到彼此不同步的状态。
const valueRefs = new Map<string, Ref<string>>();
// 每个 key 的防抖计时器与串行写入链，保证最终落盘顺序与用户输入一致。
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
const persistChains = new Map<string, Promise<void>>();
// stronghold 读取比明文 store 慢（快照需 age/scrypt 解密），依赖凭据的调用方
// 必须能等到水合完成，否则会把“尚未读到”误判为“未配置”。
const hydrationPromises = new Map<string, Promise<void>>();
// save() 会整体重新加密快照（实测约 600ms，与数据量无关），
// 因此把并发写入合并成尽量少的保存次数。
let saveInFlight: Promise<void> | null = null;
let pendingSave: Promise<void> | null = null;

/**
 * 读取或生成设备密钥；生成时使用密码学安全随机源。
 */
async function resolveDevicePassword(): Promise<string> {
    const baseDirectory = await appLocalDataDir();
    const keyFilePath = await join(baseDirectory, DEVICE_KEY_FILE_NAME);

    if (await exists(keyFilePath)) {
        const storedKey = (await readTextFile(keyFilePath)).trim();

        if (storedKey) {
            return storedKey;
        }
    }

    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const generatedKey = Array.from(randomBytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

    await writeTextFile(keyFilePath, generatedKey);

    return generatedKey;
}

/**
 * stronghold 的错误经 Tauri IPC 后是字符串，只能按文案判别，
 * 文案取自 iota_stronghold 的 ClientError 定义。
 */
function toErrorText(error: unknown): string {
    if (typeof error === "string") {
        return error;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

/** 客户端已在本次进程内加载过：凭据仍在内存，应当复用而非新建。 */
function isClientAlreadyLoadedError(error: unknown): boolean {
    return /has already been loaded/iu.test(toErrorText(error));
}

/** 快照里没有该客户端：首次运行，可以安全新建。 */
function isClientDataMissingError(error: unknown): boolean {
    return /no data present|client data not present/iu.test(toErrorText(error));
}

/**
 * 合并快照保存：单次 save() 就会把整个快照重新加密（age/scrypt，实测约 600ms），
 * 与写入条数无关。因此多个 key 同时落盘时没必要各保存一次——
 * 只要某次 save 尚未开始，就复用它，等它写完即可覆盖所有已写入内存的改动。
 *
 * 注意不能直接复用「正在进行中」的 save：它可能在当前写入之前就已读取状态，
 * 因此进行中时要再排一次，保证本次改动一定被写入磁盘。
 */
async function saveSnapshot(): Promise<void> {
    if (!strongholdInstance) {
        throw new Error("stronghold 实例尚未就绪，无法持久化凭据。");
    }

    // 已有排队中的保存尚未开始执行，它会覆盖本次改动，直接复用。
    if (pendingSave) {
        return pendingSave;
    }

    const stronghold = strongholdInstance;
    const previous = saveInFlight ?? Promise.resolve();

    pendingSave = (async () => {
        // 等待进行中的保存结束，避免并发 save 互相覆盖。
        await previous.catch(() => undefined);
        // 从这一刻起本次保存已开始，后续写入必须另外排队。
        pendingSave = null;
        await stronghold.save();
    })();

    saveInFlight = pendingSave.catch(() => undefined);

    return pendingSave;
}

async function getClient(): Promise<Client> {
    if (clientPromise) {
        return clientPromise;
    }

    clientPromise = (async () => {
        const baseDirectory = await appLocalDataDir();
        const snapshotPath = await join(baseDirectory, SNAPSHOT_FILE_NAME);
        const password = await resolveDevicePassword();
        const stronghold = await Stronghold.load(snapshotPath, password);
        strongholdInstance = stronghold;

        try {
            return await stronghold.loadClient(CLIENT_NAME);
        } catch (error: unknown) {
            // Rust 侧按快照路径缓存 stronghold 实例，客户端一旦加载就常驻内存。
            // 网页重载（dev 热更新、手动刷新）会再走一次 load，此时 loadClient 报
            // 「已加载过」——这不是「客户端不存在」，绝不能新建空客户端顶替：
            // create_client 会把内存中已有凭据的客户端整体覆盖成空，随后任何一次
            // save() 都会把空状态写回快照，用户已保存的 API Key 就此被抹掉。
            if (isClientAlreadyLoadedError(error)) {
                return new Client(snapshotPath, CLIENT_NAME as ClientPath);
            }

            // 只有确认快照里确实没有该客户端（首次运行）时才新建。
            if (isClientDataMissingError(error)) {
                return await stronghold.createClient(CLIENT_NAME);
            }

            // 其他错误（如快照解密失败）必须抛出，否则会用空客户端覆盖真实凭据。
            throw error;
        }
    })().catch((error: unknown) => {
        clientPromise = null;
        throw error;
    });

    return clientPromise;
}

export class SecretStore {
    /**
     * 提前开始解密快照。
     *
     * 快照解密固定要花 ~600ms（age/scrypt，与数据量无关），且这笔开销只发生一次
     * ——client 会缓存复用。但它默认是懒触发的：谁第一个读凭据谁承担，
     * 通常就是用户打开设置页或 AI 对话页的那一刻，表现为「API Key 加载很慢」。
     *
     * 启动时不 await 地调用一次，这笔固定开销就与其余初始化并行，
     * 等用户真正翻到设置页时往往已经解完了。
     *
     * 失败无需在此处理：真正的读取方会各自拿到并上报错误。
     */
    public static prewarm(): void {
        void getClient().catch((error: unknown) => {
            console.error("预热加密凭据存储失败");
            console.error(error);
        });
    }

    /**
     * 读取指定凭据；不存在时返回空字符串。
     *
     * 注意：读取失败会抛出而不是返回空串——空串会被上层误判为「未设置」，
     * 从而触发重复迁移或覆盖掉已有凭据。
     */
    public static async get(key: string): Promise<string> {
        const client = await getClient();
        const store = client.getStore();
        const value = await store.get(key);

        if (!value) {
            return "";
        }

        return textDecoder.decode(new Uint8Array(value));
    }

    /**
     * 读取凭据，失败时返回空字符串。供无需区分「读取失败」与「未设置」的调用方使用。
     */
    public static async getSafe(key: string): Promise<string> {
        try {
            return await SecretStore.get(key);
        } catch (error: unknown) {
            console.error(`读取加密凭据失败: ${key}`);
            console.error(error);
            return "";
        }
    }

    /**
     * 写入指定凭据；传入空值等同于删除。
     *
     * 写入失败必须抛出：静默失败会让用户以为已保存，重启后凭据丢失。
     */
    public static async set(key: string, value: string): Promise<void> {
        const client = await getClient();
        const store = client.getStore();

        if (!value) {
            await store.remove(key);
        } else {
            await store.insert(key, Array.from(textEncoder.encode(value)));
        }

        // 必须显式 save，否则内容只留在内存中，重启后丢失。
        await saveSnapshot();
    }

    /**
     * 创建与加密存储自动同步的响应式引用，用法对齐 PersistentStore.useValue。
     *
     * legacyKey 用于一次性迁移：若加密存储为空而 settings.json 中仍有明文旧值，
     * 则搬迁到加密存储并清除明文。
     */
    public static useValue(key: string, legacyKey?: string): Ref<string> {
        const existingRef = valueRefs.get(key);

        if (existingRef) {
            return existingRef;
        }

        const state = ref("");
        let hydrating = false;
        let initialized = false;
        // 用户可能在异步水合完成前就已输入，此时不能用旧值覆盖，也不能丢弃写入。
        let dirtyBeforeReady = false;

        valueRefs.set(key, state);

        const hydrationPromise = (async () => {
            try {
                let value = await SecretStore.get(key);

                if (!value && legacyKey) {
                    value = await SecretStore.migrateLegacyPlainValue(
                        key,
                        legacyKey,
                    );
                }

                // 水合期间用户已经改过值，保留用户输入并落盘。
                if (dirtyBeforeReady) {
                    return;
                }

                hydrating = true;
                state.value = value;
                hydrating = false;
            } catch (error: unknown) {
                console.error(`初始化加密凭据失败: ${key}`);
                console.error(error);
            } finally {
                initialized = true;

                if (dirtyBeforeReady) {
                    // 走同一条串行链，避免与后续防抖写入竞争顺序。
                    SecretStore.schedulePersist(key, state.value);
                }
            }
        })();

        hydrationPromises.set(key, hydrationPromise);

        // flush 必须为 sync：默认的 'pre' 会把回调推迟到 nextTick，届时 hydrating
        // 已被复位成 false，水合赋值会被误判为用户输入并触发一次回写。
        // 该回写发生在 initialized 之后，会把刚读到的值原样写回，
        // 一旦水合读到的是空值（例如读取失败）就会把快照里的真实凭据覆盖成空。
        watch(
            state,
            (nextValue) => {
                if (hydrating) {
                    return;
                }

                if (!initialized) {
                    dirtyBeforeReady = true;
                    return;
                }

                SecretStore.schedulePersist(key, nextValue);
            },
            { flush: "sync" },
        );

        return state;
    }

    /**
     * 等待指定凭据完成首次水合。
     *
     * 供“根据凭据是否存在决定后续行为”的调用方使用，避免在读到之前就做判断。
     */
    public static async ready(...keys: string[]): Promise<void> {
        await Promise.all(
            keys.map((key) => hydrationPromises.get(key) ?? Promise.resolve()),
        );
    }

    /**
     * 防抖落盘：输入停下后再写入，并串行排队避免并发 save 互相覆盖。
     */
    private static schedulePersist(key: string, value: string) {
        const existingTimer = persistTimers.get(key);

        if (existingTimer) {
            globalThis.clearTimeout(existingTimer);
        }

        const timer = globalThis.setTimeout(() => {
            persistTimers.delete(key);

            const previousChain = persistChains.get(key) ?? Promise.resolve();
            const nextChain = previousChain
                .catch(() => undefined)
                .then(() => SecretStore.persistValue(key, value));

            persistChains.set(key, nextChain);
        }, PERSIST_DEBOUNCE_MS);

        persistTimers.set(key, timer);
    }

    /**
     * 立即写入待落盘的值，供需要确保已保存的场景（如退出前）调用。
     */
    public static async flush(key: string): Promise<void> {
        const existingTimer = persistTimers.get(key);

        if (existingTimer) {
            globalThis.clearTimeout(existingTimer);
            persistTimers.delete(key);

            const state = valueRefs.get(key);

            if (state) {
                await SecretStore.persistValue(key, state.value);
            }
        }

        await persistChains.get(key)?.catch(() => undefined);
    }

    /**
     * 落盘所有已注册 key 的待写入值；供应用退出前统一调用。
     *
     * 防抖窗口内退出应用（如点击托盘“退出”）会跳过 setTimeout 回调，
     * 若不在退出前主动 flush，用户刚填的凭据永远不会落盘，重启后又变回空。
     */
    public static async flushAll(): Promise<void> {
        await Promise.all(
            Array.from(valueRefs.keys()).map((key) => SecretStore.flush(key)),
        );
    }

    /**
     * 写入并在失败时给出可见反馈，避免用户以为已保存。
     */
    private static async persistValue(key: string, value: string) {
        try {
            await SecretStore.set(key, value);
        } catch (error: unknown) {
            console.error(`保存加密凭据失败: ${key}`);
            console.error(error);
            // 凭据保存失败必须让用户知道，否则重启后才发现配置丢了。
            ElMessage.error("凭据保存失败，请重试。");
        }
    }

    /**
     * 将 settings.json 中的明文旧值迁移到加密存储，并清空明文残留。
     */
    private static async migrateLegacyPlainValue(
        key: string,
        legacyKey: string,
    ): Promise<string> {
        const migratedFlagKey = `${MIGRATED_FLAG_PREFIX}:${legacyKey}`;
        const alreadyMigrated = await PersistentStore.get<boolean>(
            migratedFlagKey,
            false,
        );

        // 迁移只做一次：明文已被清空后重复进入会把凭据覆盖成空值。
        if (alreadyMigrated) {
            return "";
        }

        const legacyValue = (
            await PersistentStore.get<string>(legacyKey, "")
        )?.trim();

        if (!legacyValue) {
            await PersistentStore.set(migratedFlagKey, true, true);
            return "";
        }

        // 先确保写入成功再清除明文，否则中途失败会导致凭据彻底丢失。
        await SecretStore.set(key, legacyValue);
        await PersistentStore.set(legacyKey, "", true);
        await PersistentStore.set(migratedFlagKey, true, true);

        return legacyValue;
    }

    /**
     * 迁移结构化凭据（如 NexusMods 用户信息中的 key 字段）。
     */
    public static async migrateLegacyJsonField<T extends object>(
        secretKey: string,
        legacyKey: string,
        fieldName: keyof T & string,
    ): Promise<void> {
        const migratedFlagKey = `${MIGRATED_FLAG_PREFIX}:${legacyKey}`;
        const migrated = await PersistentStore.get<boolean>(
            migratedFlagKey,
            false,
        );

        if (migrated) {
            return;
        }

        try {
            const legacyValue = await PersistentStore.get<T | null>(
                legacyKey,
                null,
            );
            const secretValue = legacyValue?.[fieldName];

            if (typeof secretValue === "string" && secretValue.trim()) {
                await SecretStore.set(secretKey, secretValue.trim());

                // 明文配置里只保留去掉密钥字段后的展示信息。
                const sanitizedValue = { ...legacyValue, [fieldName]: "" };
                await PersistentStore.set(legacyKey, sanitizedValue, true);
            }

            await PersistentStore.set(migratedFlagKey, true, true);
        } catch (error: unknown) {
            // 迁移失败时不落标记，下次启动重试，避免凭据丢失。
            console.error(`迁移加密凭据失败: ${legacyKey}`);
            console.error(error);
        }
    }
}
