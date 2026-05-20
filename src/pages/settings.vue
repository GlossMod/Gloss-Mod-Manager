<script setup lang="ts">
import { openUrl } from "@tauri-apps/plugin-opener";
import { ElMessage } from "element-plus-message";
import { useI18n } from "vue-i18n";
import type { AppLocale } from "@/lang/locales";
import { type ThemeMode } from "@/lib/theme";
import { useSettings } from "@/stores/settings";

const settings = useSettings();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const {
    autoAddAfterDownload,
    autoStart,
    autoStartLoading,
    debugInfo,
    debugMode,
    defaultStartPage,
    language,
    closeSoftLinks,
    modifiableDuringGame,
    nexusModsAuthorized,
    nexusModsLoginLoading,
    nexusModsUser,
    selectGameByFolder,
    showPreloadList,
    storagePath,
    theme,
    baseUrl,
    apiKey,
    glossModKey,
} = storeToRefs(settings);

const themeModel = computed<ThemeMode>({
    get: () => theme.value,
    set: (value) => settings.setTheme(value),
});

const languageModel = computed<AppLocale>({
    get: () => language.value,
    set: (value) => settings.setLanguage(value),
});

const autoStartModel = computed({
    get: () => autoStart.value,
    set: async (value: boolean) => {
        try {
            await settings.setAutoStart(value);
        } catch (error: unknown) {
            console.error(t("settings.autoStartError"));
            console.error(error);
            ElMessage.error(t("settings.autoStartError"));
        }
    },
});

async function handleNexusModsLogin() {
    try {
        const user = await settings.loginNexusModsUser();
        ElMessage.success(
            t("settings.nexus.authorizeSuccess", { name: user.name }),
        );
    } catch (error: unknown) {
        console.error(t("settings.nexus.authorizeFailed"));
        console.error(error);
        ElMessage.error(
            error instanceof Error
                ? error.message
                : t("settings.nexus.authorizeFailed"),
        );
    }
}

function handleNexusModsLogout() {
    settings.clearNexusModsAuthorization();
    ElMessage.success(t("settings.nexus.cleared"));
}

async function openNexusModsProfile() {
    const profileUrl = `https://www.nexusmods.com/profile/${nexusModsUser.value?.name?.trim()}`;

    if (!profileUrl) {
        return;
    }

    try {
        await openUrl(profileUrl);
    } catch (error: unknown) {
        console.error(t("settings.nexus.openProfileFailed"));
        console.error(error);
        ElMessage.error(t("settings.nexus.openProfileFailed"));
    }
}

watch(
    () => route.query.nexusAuthAction,
    (action) => {
        if (
            action !== "login" ||
            nexusModsAuthorized.value ||
            nexusModsLoginLoading.value
        ) {
            return;
        }

        const nextQuery = { ...route.query };
        delete nextQuery.nexusAuthAction;

        // 通过路由参数触发与按钮一致的登录流程，避免重复执行。
        void router.replace({
            path: route.path,
            query: nextQuery,
        });
        void handleNexusModsLogin();
    },
    { immediate: true },
);
</script>
<template>
    <div class="flex flex-col gap-6">
        <Card>
            <CardHeader>
                <CardTitle>
                    <h1>{{ t("settings.title") }}</h1>
                </CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <h3>{{ t("settings.basic") }}</h3>
                        </CardTitle>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-8">
                        <div class="grid grid-cols-4 items-center gap-8">
                            <!-- 这个站两格 -->
                            <div class="col-span-2 items-center">
                                <InputGroup>
                                    <InputGroupInput
                                        id="storage-path"
                                        v-model="storagePath"
                                        disabled
                                    ></InputGroupInput>
                                    <InputGroupAddon>
                                        <Label
                                            for="storage-path"
                                            class="text-sm font-medium"
                                            >{{
                                                t("settings.storagePath")
                                            }}</Label
                                        >
                                    </InputGroupAddon>
                                    <InputGroupAddon align="inline-end">
                                        <Button
                                            variant="secondary"
                                            @click="settings.selectStoragePath"
                                        >
                                            {{ t("settings.choose") }}
                                        </Button>
                                    </InputGroupAddon>
                                </InputGroup>
                            </div>
                            <div class="flex gap-2 items-center">
                                <Label
                                    for="theme-model"
                                    class="text-sm font-medium"
                                    >{{ t("settings.theme") }}</Label
                                >
                                <Select id="theme-model" v-model="themeModel">
                                    <SelectTrigger>
                                        <SelectValue
                                            :placeholder="
                                                t('settings.chooseTheme')
                                            "
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="system">{{
                                            t("settings.themeSystem")
                                        }}</SelectItem>
                                        <SelectItem value="light">
                                            {{ t("settings.themeLight") }}
                                        </SelectItem>
                                        <SelectItem value="dark">{{
                                            t("settings.themeDark")
                                        }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="flex gap-2 items-center">
                                <Label
                                    for="language-model"
                                    class="text-sm font-medium"
                                    >{{ t("settings.language") }}</Label
                                >
                                <Select
                                    id="language-model"
                                    v-model="languageModel"
                                >
                                    <SelectTrigger>
                                        <SelectValue
                                            :placeholder="
                                                t('settings.chooseLanguage')
                                            "
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem
                                            v-for="item in settings.languageOptions"
                                            :key="item.value"
                                            :value="item.value"
                                        >
                                            {{ item.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="flex gap-2 items-center">
                                <Label
                                    for="default-start-page"
                                    class="text-sm font-medium"
                                    >{{ t("settings.defaultStartPage") }}</Label
                                >
                                <Select
                                    id="default-start-page"
                                    v-model="defaultStartPage"
                                >
                                    <SelectTrigger>
                                        <SelectValue
                                            :placeholder="
                                                t(
                                                    'settings.chooseDefaultStartPage',
                                                )
                                            "
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem
                                            v-for="item in settings.settingsStartPageOptions"
                                            :key="item.value"
                                            :value="item.value"
                                        >
                                            {{ t(item.labelKey) }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div class="grid grid-cols-4 items-center gap-8">
                            <div class="flex gap-2 items-center">
                                <Label for="auto-add-after-download">{{
                                    t("settings.autoAddAfterDownload")
                                }}</Label>
                                <Switch
                                    id="auto-add-after-download"
                                    v-model="autoAddAfterDownload"
                                />
                            </div>
                            <div class="flex gap-2 items-center">
                                <Label for="select-game-by-folder">{{
                                    t("settings.selectGameByFolder")
                                }}</Label>
                                <Switch
                                    id="select-game-by-folder"
                                    v-model="selectGameByFolder"
                                />
                            </div>
                            <div class="flex gap-2 items-center">
                                <Label for="auto-start">{{
                                    t("settings.autoStart")
                                }}</Label>
                                <Switch
                                    id="auto-start"
                                    v-model="autoStartModel"
                                    :disabled="autoStartLoading"
                                />
                            </div>
                            <div class="flex gap-2 items-center">
                                <Label for="modifiable-during-game">{{
                                    t("settings.modifiableDuringGame")
                                }}</Label>
                                <Switch
                                    id="modifiable-during-game"
                                    v-model="modifiableDuringGame"
                                />
                            </div>
                            <div class="flex gap-2 items-center">
                                <Label for="show-preload-list">{{
                                    t("settings.showPreloadList")
                                }}</Label>
                                <Switch
                                    id="show-preload-list"
                                    v-model="showPreloadList"
                                />
                            </div>
                            <div class="flex gap-2 items-center">
                                <Label for="disable-symlink-install">{{
                                    t("settings.closeSoftLinks")
                                }}</Label>
                                <Switch
                                    id="disable-symlink-install"
                                    v-model="closeSoftLinks"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card id="ai-config" class="scroll-mt-4">
                    <CardHeader>
                        <CardTitle>
                            <h3>AI配置</h3>
                        </CardTitle>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-4">
                        <div class="grid grid-cols-3 items-center gap-4">
                            <div class="flex items-center">
                                <InputGroup>
                                    <InputGroupInput
                                        type="text"
                                        placeholder="Base Url"
                                        v-model="baseUrl"
                                    />
                                    <InputGroupAddon>
                                        <icon-link />
                                    </InputGroupAddon>
                                </InputGroup>
                            </div>
                            <div class="flex items-center">
                                <InputGroup>
                                    <InputGroupInput
                                        type="password"
                                        placeholder="API Key"
                                        v-model="apiKey"
                                    />
                                    <InputGroupAddon>
                                        <icon-key-square />
                                    </InputGroupAddon>
                                </InputGroup>
                            </div>
                            <div class="flex items-center gap-2">
                                <Button variant="outline" as-child>
                                    <a
                                        href="https://one-docs.gloscai.com/apps/GlossModManager.html"
                                        target="_blank"
                                        class="flex items-center gap-1"
                                    >
                                        配置教程 <icon-external-link />
                                    </a>
                                </Button>
                                <Button variant="outline" as-child>
                                    <a
                                        href="https://gmm.aoe.top/docs/UseAi"
                                        target="_blank"
                                        class="flex items-center gap-1"
                                    >
                                        使用教程 <icon-external-link />
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <h3>{{ t("settings.authorization") }}</h3>
                        </CardTitle>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-4">
                        <div
                            class="rounded-xl border border-border/70 bg-muted/40 p-4"
                        >
                            <div
                                class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                            >
                                <div class="space-y-1">
                                    <div class="flex items-center gap-2">
                                        <span class="text-sm font-medium">
                                            NexusMods
                                        </span>
                                        <Badge
                                            class="rounded-full"
                                            :variant="
                                                nexusModsAuthorized
                                                    ? 'secondary'
                                                    : 'outline'
                                            "
                                        >
                                            {{
                                                nexusModsAuthorized
                                                    ? t(
                                                          "settings.nexus.statusAuthorized",
                                                      )
                                                    : t(
                                                          "settings.nexus.statusUnauthorized",
                                                      )
                                            }}
                                        </Badge>
                                    </div>
                                    <p
                                        v-if="
                                            nexusModsAuthorized && nexusModsUser
                                        "
                                        class="text-sm text-muted-foreground"
                                    >
                                        {{
                                            t("settings.nexus.currentAccount", {
                                                name: nexusModsUser.name,
                                                id: nexusModsUser.user_id,
                                            })
                                        }}
                                    </p>
                                    <p
                                        v-else
                                        class="text-sm text-muted-foreground"
                                    >
                                        {{ t("settings.nexus.ssoRequired") }}
                                    </p>
                                </div>

                                <div class="flex flex-wrap gap-2">
                                    <Button
                                        variant="secondary"
                                        :disabled="nexusModsLoginLoading"
                                        @click="handleNexusModsLogin"
                                    >
                                        {{
                                            nexusModsAuthorized
                                                ? t(
                                                      "settings.nexus.reauthorize",
                                                  )
                                                : t("settings.nexus.login")
                                        }}
                                    </Button>
                                    <Button
                                        v-if="
                                            nexusModsAuthorized &&
                                            nexusModsUser?.profile_url
                                        "
                                        variant="outline"
                                        @click="openNexusModsProfile"
                                    >
                                        {{ t("settings.nexus.openProfile") }}
                                    </Button>
                                    <Button
                                        v-if="nexusModsAuthorized"
                                        variant="outline"
                                        @click="handleNexusModsLogout"
                                    >
                                        {{
                                            t(
                                                "settings.nexus.clearAuthorization",
                                            )
                                        }}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div
                            class="rounded-xl border border-border/70 bg-muted/40 p-4"
                        >
                            <div class="flex flex-wrap gap-2 items-center">
                                <div class="flex items-center">
                                    <span class="text-sm font-medium">
                                        3DM Mods
                                    </span>
                                </div>
                                <InputGroup claww="w-full">
                                    <InputGroupInput
                                        type="password"
                                        placeholder="输入你的3DM Mods Key"
                                        v-model="glossModKey"
                                    />
                                    <InputGroupAddon>
                                        <icon-key-square />
                                    </InputGroupAddon>
                                </InputGroup>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <h3>{{ t("settings.advanced") }}</h3>
                        </CardTitle>
                    </CardHeader>
                    <CardContent class="flex flex-col gap-4">
                        <div class="grid grid-cols-4 items-center gap-4">
                            <div class="flex gap-2 items-center">
                                <Label for="debug-mode">{{
                                    t("settings.debugMode")
                                }}</Label>
                                <Switch id="debug-mode" v-model="debugMode" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
        <Card v-if="debugMode">
            <CardHeader>
                <CardTitle>
                    <h3>{{ t("settings.debugInfo") }}</h3>
                </CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
                <pre class="max-h-75 overflow-auto p-4 rounded text-sm">{{
                    JSON.stringify(debugInfo, null, 2)
                }}</pre>
            </CardContent>
        </Card>
    </div>
</template>
<style scoped></style>
