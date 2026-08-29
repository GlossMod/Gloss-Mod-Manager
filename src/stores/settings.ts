import { documentDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Language } from "@/lib/language";
import { AutoStart } from "@/lib/auto-start";
import { PersistentStore } from "@/lib/persistent-store";
import { SecretStore } from "@/lib/secret-store";
import { validateNexusModsUser } from "@/lib/third-party-mod-api";
import { Theme } from "@/lib/theme";
import { computed, ref, watch } from "vue";

const NEXUS_SSO_SESSION_ID_KEY = "nexus-sso-id";
const NEXUS_SSO_CONNECTION_TOKEN_KEY = "nexus-sso-connection-token";

interface INexusSsoResponse {
    success: boolean;
    error?: string;
    data: {
        connection_token?: string;
        api_key?: string;
    };
}

function toError(error: unknown, fallbackMessage: string) {
    if (error instanceof Error) {
        return error;
    }

    if (typeof error === "string" && error.trim()) {
        return new Error(error);
    }

    if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.trim()
    ) {
        return new Error(error.message);
    }

    return new Error(fallbackMessage);
}

function getOrCreateNexusSsoId() {
    const existingId = sessionStorage.getItem(NEXUS_SSO_SESSION_ID_KEY)?.trim();

    if (existingId) {
        return existingId;
    }

    const nextId =
        globalThis.crypto?.randomUUID?.().replace(/-/gu, "") ??
        `${Date.now()}${Math.round(Math.random() * 100000)}`;

    sessionStorage.setItem(NEXUS_SSO_SESSION_ID_KEY, nextId);
    return nextId;
}

export const settingsStartPageOptions = [
    { labelKey: "settings.pages.home", value: "/" },
    { labelKey: "settings.pages.games", value: "/games" },
    { labelKey: "settings.pages.manager", value: "/manager" },
    { labelKey: "settings.pages.explore", value: "/explore" },
    { labelKey: "settings.pages.download", value: "/download" },
    { labelKey: "settings.pages.mcp", value: "/mcp" },
    { labelKey: "settings.pages.backup", value: "/backup" },
    { labelKey: "settings.pages.about", value: "/about" },
    { labelKey: "settings.pages.aiChat", value: "/ai-chat" },
    { labelKey: "settings.pages.settings", value: "/settings" },
] as const;

export const useSettings = defineStore("Settings", () => {
    const { theme, setTheme } = Theme.use();
    const { language, languageOptions, setLanguage } = Language.use();
    const { autoStart, autoStartLoading, setAutoStart } = AutoStart.use();

    const defaultStartPage = PersistentStore.useValue<string>(
        "defaultStartPage",
        "/",
    );
    const storagePath = PersistentStore.useValue<string>("storagePath", "");
    const autoAddAfterDownload = PersistentStore.useValue<boolean>(
        "autoAddAfterDownload",
        true,
    );
    const selectGameByFolder = PersistentStore.useValue<boolean>(
        "selectGameByFolder",
        false,
    );
    const debugMode = PersistentStore.useValue<boolean>("debugMode", false);
    const modifiableDuringGame = PersistentStore.useValue<boolean>(
        "modifiableDuringGame",
        false,
    );
    const showPreloadList = PersistentStore.useValue<boolean>(
        "showPreloadList",
        true,
    );
    const closeSoftLinks = PersistentStore.useValue<boolean>(
        "closeSoftLinks",
        false,
    );
    const managerGridEnabled = PersistentStore.useValue<boolean>(
        "managerGridEnabled",
        false,
    );
    const mcpToolsEnabled = PersistentStore.useValue<boolean>(
        "mcpToolsEnabled",
        true,
    );
    const mcpToolItemEnabledMap = PersistentStore.useValue<
        Record<string, boolean>
    >("mcpToolItemEnabledMap", {});
    const mcpResourcesEnabled = PersistentStore.useValue<boolean>(
        "mcpResourcesEnabled",
        true,
    );
    const mcpResourceItemEnabledMap = PersistentStore.useValue<
        Record<string, boolean>
    >("mcpResourceItemEnabledMap", {});
    const mcpPromptsEnabled = PersistentStore.useValue<boolean>(
        "mcpPromptsEnabled",
        true,
    );
    const mcpPromptItemEnabledMap = PersistentStore.useValue<
        Record<string, boolean>
    >("mcpPromptItemEnabledMap", {});
    const nexusModsUserProfile = PersistentStore.useValue<INexusModsUser | null>(
        "nexusModsUser",
        null,
    );
    // NexusMods 令牌单独存入加密存储，settings.json 中仅保留展示用的资料字段。
    const nexusModsToken = SecretStore.useValue("nexusModsToken");

    // 向下兼容：外部仍按 nexusModsUser.key 读取令牌，这里在内存中回填。
    const nexusModsUser = computed<INexusModsUser | null>(() => {
        if (!nexusModsUserProfile.value) {
            return null;
        }

        return {
            ...nexusModsUserProfile.value,
            key: nexusModsToken.value,
        };
    });

    const baseUrl = PersistentStore.useValue<string>("agentbaseUrl", "");
    // AI API Key 与 GlossMod Key 属于凭据，从明文配置迁移到加密存储。
    const apiKey = SecretStore.useValue("agentApiKey", "agentApiKey");

    const glossModKey = SecretStore.useValue("glossModKey", "glossModKey");

    void SecretStore.migrateLegacyJsonField<INexusModsUser>(
        "nexusModsToken",
        "nexusModsUser",
        "key",
    );

    /**
     * 等待凭据从加密存储完成首次读取。
     *
     * stronghold 读取比明文 store 慢，依赖 apiKey 判断配置完整性的逻辑必须先 await 这个。
     */
    async function waitForCredentials() {
        await SecretStore.ready(
            "agentApiKey",
            "glossModKey",
            "nexusModsToken",
        );
    }

    const debugInfo = ref<unknown>({});
    const nexusModsLoginLoading = ref(false);

    const nexusModsAuthorized = computed(() => {
        return Boolean(nexusModsToken.value.trim());
    });

    watch(
        debugMode,
        async (newValue) => {
            if (!newValue) {
                debugInfo.value = {};
                return;
            }

            debugInfo.value = await PersistentStore.getAllKeys();
        },
        { immediate: true },
    );

    async function selectStoragePath() {
        const selected = await open({
            directory: true,
            defaultPath:
                storagePath.value ||
                (await join(await documentDir(), "Gloss Mod Manager")),
            title: "选择储存路径",
        });

        if (selected) {
            storagePath.value = selected;
        }
    }

    async function ensureDefaultStoragePath() {
        const savedStoragePath =
            (await PersistentStore.get<string>("storagePath", "")) ?? "";

        if (savedStoragePath.trim() || storagePath.value.trim()) {
            return;
        }

        // 等待持久化读取完成后再补默认路径，避免覆盖用户已保存的路径。
        storagePath.value = await join(
            await documentDir(),
            "Gloss Mod Manager",
        );
    }

    void ensureDefaultStoragePath().catch((error: unknown) => {
        console.error("初始化默认储存路径失败");
        console.error(error);
    });

    async function loginNexusModsUser() {
        if (nexusModsLoginLoading.value) {
            throw new Error("NexusMods 授权正在进行中，请稍候。");
        }

        nexusModsLoginLoading.value = true;

        try {
            return await new Promise<INexusModsUser>((resolve, reject) => {
                const ws = new WebSocket("wss://sso.nexusmods.com");
                const nexusSsoId = getOrCreateNexusSsoId();
                const connectionToken = sessionStorage.getItem(
                    NEXUS_SSO_CONNECTION_TOKEN_KEY,
                );
                let settled = false;

                const finalize = (
                    callback: (value?: INexusModsUser | Error) => void,
                    value?: INexusModsUser | Error,
                ) => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    callback(value);
                };

                ws.onopen = () => {
                    ws.send(
                        JSON.stringify({
                            id: nexusSsoId,
                            token: connectionToken,
                            protocol: 2,
                        }),
                    );

                    void openUrl(
                        `https://www.nexusmods.com/sso?id=${nexusSsoId}&application=gloss`,
                    ).catch((error: unknown) => {
                        console.error("打开 NexusMods 授权页失败");
                        console.error(error);
                    });
                };

                ws.onerror = () => {
                    finalize(
                        (value) => reject(value),
                        new Error("连接 NexusMods SSO 失败。"),
                    );
                };

                ws.onclose = () => {
                    if (!settled) {
                        finalize(
                            (value) => reject(value),
                            new Error("NexusMods SSO 连接已关闭，请重试。"),
                        );
                    }
                };

                ws.onmessage = async (event) => {
                    try {
                        const response = JSON.parse(
                            String(event.data),
                        ) as INexusSsoResponse;

                        if (!response?.success) {
                            throw new Error(
                                response?.error || "NexusMods 授权失败。",
                            );
                        }

                        if (response.data.connection_token) {
                            sessionStorage.setItem(
                                NEXUS_SSO_CONNECTION_TOKEN_KEY,
                                response.data.connection_token,
                            );
                        }

                        if (!response.data.api_key) {
                            return;
                        }

                        const user = await validateNexusModsUser(
                            response.data.api_key,
                        );
                        // 令牌写入加密存储，明文配置里只留展示信息。
                        nexusModsToken.value = response.data.api_key;
                        nexusModsUserProfile.value = { ...user, key: "" };
                        finalize(
                            (value) => resolve(value as INexusModsUser),
                            user,
                        );
                        ws.close();
                    } catch (error: unknown) {
                        console.log(error);

                        finalize(
                            (value) => reject(value),
                            toError(error, "解析 NexusMods 授权结果失败。"),
                        );
                        ws.close();
                    }
                };
            });
        } finally {
            nexusModsLoginLoading.value = false;
        }
    }

    function clearNexusModsAuthorization() {
        nexusModsUserProfile.value = null;
        nexusModsToken.value = "";
        sessionStorage.removeItem(NEXUS_SSO_CONNECTION_TOKEN_KEY);
    }

    return {
        theme,
        setTheme,
        language,
        languageOptions,
        setLanguage,
        autoStart,
        autoStartLoading,
        setAutoStart,
        defaultStartPage,
        storagePath,
        autoAddAfterDownload,
        selectGameByFolder,
        debugMode,
        modifiableDuringGame,
        showPreloadList,
        closeSoftLinks,
        managerGridEnabled,
        mcpToolsEnabled,
        mcpToolItemEnabledMap,
        mcpResourcesEnabled,
        mcpResourceItemEnabledMap,
        mcpPromptsEnabled,
        mcpPromptItemEnabledMap,
        nexusModsUser,
        nexusModsAuthorized,
        nexusModsLoginLoading,
        debugInfo,
        settingsStartPageOptions,
        baseUrl,
        apiKey,
        glossModKey,
        selectStoragePath,
        loginNexusModsUser,
        clearNexusModsAuthorization,
        waitForCredentials,
    };
});
