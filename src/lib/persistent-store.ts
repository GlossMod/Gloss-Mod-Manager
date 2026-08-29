import { LazyStore } from "@tauri-apps/plugin-store";
import { isProxy, ref, toRaw } from "vue";
import type { Ref } from "vue";
import { watch } from "vue";

export class PersistentStore {
    public static readonly store = new LazyStore("settings.json");
    private static readonly valueRefs = new Map<string, Ref<unknown>>();
    private static readonly suppressNextWatchKeys = new Set<string>();
    private static readonly valueVersions = new Map<string, number>();

    /**
     * 读取指定键的持久化值；未命中时返回默认值副本。
     */
    public static async get<T>(
        key: string,
        fallback?: T,
    ): Promise<T | undefined> {
        const value = await PersistentStore.store.get<T>(key);

        if (value === undefined && fallback !== undefined) {
            return PersistentStore.cloneValue(fallback);
        }

        return value;
    }

    /**
     * 写入指定键的持久化值。
     */
    public static async set<T>(
        key: string,
        value: T,
        flushToDisk: boolean = false,
    ): Promise<void> {
        const nextValue = PersistentStore.cloneValue(value);
        const writeVersion = PersistentStore.bumpValueVersion(key);

        await PersistentStore.store.set(key, nextValue);

        if (flushToDisk) {
            await PersistentStore.store.save();
        }

        if (PersistentStore.getValueVersion(key) !== writeVersion) {
            return;
        }

        PersistentStore.syncValueRef(key, nextValue);
    }

    /**
     * 创建一个和 Tauri Store 自动同步的响应式引用。
     */
    public static useValue<T>(key: string, fallback: T): Ref<T> {
        const existingRef = PersistentStore.valueRefs.get(key);

        if (existingRef) {
            return existingRef as Ref<T>;
        }

        const state = ref(PersistentStore.cloneValue(fallback)) as Ref<T>;
        let initialized = false;
        let hydrating = false;
        let dirtyBeforeReady = false;
        const initialVersion = PersistentStore.getValueVersion(key);

        PersistentStore.valueRefs.set(key, state as Ref<unknown>);

        void PersistentStore.get(key, fallback)
            .then((value) => {
                if (
                    dirtyBeforeReady ||
                    PersistentStore.getValueVersion(key) !== initialVersion
                ) {
                    return;
                }

                hydrating = true;
                state.value = value as T;
                hydrating = false;
            })
            .catch((error: unknown) => {
                PersistentStore.logError("读取", key, error);
            })
            .finally(() => {
                initialized = true;

                if (!dirtyBeforeReady) {
                    return;
                }

                void PersistentStore.set(key, state.value).catch(
                    (error: unknown) => {
                        PersistentStore.logError("写入", key, error);
                    },
                );
            });

        watch(
            state,
            (value) => {
                if (hydrating) {
                    return;
                }

                if (PersistentStore.suppressNextWatchKeys.has(key)) {
                    PersistentStore.suppressNextWatchKeys.delete(key);
                    return;
                }

                if (!initialized) {
                    dirtyBeforeReady = true;
                    return;
                }

                void PersistentStore.set(key, value).catch((error: unknown) => {
                    PersistentStore.logError("写入", key, error);
                });
            },
            { deep: true, flush: "sync" },
        );

        return state;
    }

    /**
     * 同一 key 可能在多个页面被 useValue 读取，写入后要同步到共享 ref，避免必须刷新页面才更新状态。
     */
    private static syncValueRef<T>(key: string, value: T) {
        const state = PersistentStore.valueRefs.get(key);

        if (!state) {
            return;
        }

        const nextValue = PersistentStore.cloneValue(value);

        if (Object.is(state.value, nextValue)) {
            return;
        }

        PersistentStore.suppressNextWatchKeys.add(key);
        state.value = nextValue;
    }

    /**
     * 标记指定 key 已经发生过主动写入，避免 useValue 的异步初始读取把新值覆盖回旧值。
     */
    private static bumpValueVersion(key: string) {
        const nextVersion = PersistentStore.getValueVersion(key) + 1;

        PersistentStore.valueVersions.set(key, nextVersion);

        return nextVersion;
    }

    private static getValueVersion(key: string) {
        return PersistentStore.valueVersions.get(key) ?? 0;
    }

    /**
     * 避免对象类型默认值在多个引用之间共享同一个实例。
     */
    private static cloneValue<T>(value: T): T {
        const normalizedValue = PersistentStore.unwrapProxy(value);
        if (typeof structuredClone === "function") {
            return structuredClone(normalizedValue);
        }
        return normalizedValue;
    }

    /**
     * 持久化前先移除 Vue 响应式代理，避免 structuredClone 直接克隆 Proxy 时报错。
     */
    private static unwrapProxy<T>(value: T): T {
        if (!isProxy(value)) {
            return value;
        }
        if (typeof value === "object") {
            return JSON.parse(JSON.stringify(value)) as T;
        }

        return toRaw(value) as T;
    }

    private static logError(action: string, key: string, error: unknown) {
        console.error(`PersistentStore ${action}失败: ${key}`);
        console.error(error);
    }

    /**
     * 调试面板会直接展示这些值，凭据类字段必须脱敏后再输出。
     */
    private static readonly sensitiveKeyPattern =
        /(key|token|secret|password|credential)/iu;

    public static async getAllKeys() {
        const allkeys = await PersistentStore.store.keys();
        const data = [];
        for (const key of allkeys) {
            const value = await PersistentStore.get(key, null);

            if (
                PersistentStore.sensitiveKeyPattern.test(key) &&
                typeof value === "string" &&
                value
            ) {
                data.push({ key, value: "******" });
                continue;
            }

            data.push({ key, value });
        }
        return data;
    }
}
