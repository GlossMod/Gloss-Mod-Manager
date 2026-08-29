<script setup lang="ts">
import { Languages, LoaderCircle, X } from "lucide-vue-next";
import {
    THIRD_PARTY_PROVIDER_OPTIONS,
    getThirdPartyProviderLabel,
    isThirdPartyProviderSupported,
    type ThirdPartyProvider,
} from "@/lib/third-party-mod-api";
import {
    languageOptions,
    normalizeAppLocale,
    type AppLocale,
} from "@/lang/locales";

const manager = useManager();
const settings = useSettings();
const router = useRouter();
const route = useRoute();
const providerQueryValue = getQueryString(route.query.provider);
const activeProvider = ref<sourceType>(
    isExploreProviderQueryValue(providerQueryValue)
        ? providerQueryValue
        : "GlossMod",
);
const autoTranslate = PersistentStore.useValue<boolean>(
    "exploreAutoTranslate",
    false,
);
const translationLocale = PersistentStore.useValue<AppLocale>(
    "exploreTranslationLocale",
    settings.language,
);
const showOriginal = PersistentStore.useValue<boolean>(
    "exploreTranslationShowOriginal",
    false,
);
const selectedAiModelId = PersistentStore.useValue<string>(
    "aiChatSelectedModelId",
    "",
);
const manualTranslateToken = ref(0);
const cancelTranslateToken = ref(0);
const translationBusy = ref(false);

const currentGame = computed(() => manager.managerGame);
const hasAiConfiguration = computed(() => {
    return Boolean(settings.baseUrl.trim() && settings.apiKey.trim());
});
const effectiveAutoTranslate = computed(() => {
    return autoTranslate.value && hasAiConfiguration.value;
});
const translationLocaleModel = computed<AppLocale>({
    get: () => normalizeAppLocale(translationLocale.value, settings.language),
    set: (value) => {
        translationLocale.value = normalizeAppLocale(value, settings.language);
    },
});
const activeThirdPartyProvider = computed<ThirdPartyProvider>(() => {
    return activeProvider.value === "GlossMod"
        ? "NexusMods"
        : (activeProvider.value as ThirdPartyProvider);
});
const providerOptions = computed(() => {
    return [
        {
            label: "Gloss Mod",
            value: "GlossMod" as const,
            supported: true,
        },
        ...THIRD_PARTY_PROVIDER_OPTIONS.map((item) => ({
            label: getThirdPartyProviderLabel(item.value),
            value: item.value,
            supported: isThirdPartyProviderSupported(
                currentGame.value,
                item.value,
            ),
        })),
    ];
});

function getQueryString(value: unknown) {
    return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function isExploreProviderQueryValue(value: string): value is sourceType {
    return (
        value === "GlossMod" ||
        THIRD_PARTY_PROVIDER_OPTIONS.some((item) => item.value === value)
    );
}

function syncActiveProviderQuery() {
    if (route.path !== "/explore") {
        return;
    }

    const nextQuery = { ...route.query };

    if (activeProvider.value === "GlossMod") {
        delete nextQuery.provider;
    } else {
        nextQuery.provider = activeProvider.value;
    }

    if (
        String(route.query.provider ?? "") ===
        String(nextQuery.provider ?? "")
    ) {
        return;
    }

    void router.replace({
        path: "/explore",
        query: nextQuery,
    });
}

watch(
    currentGame,
    (game) => {
        if (activeProvider.value === "GlossMod") {
            return;
        }

        // managerGame 由持久化存储异步注水，首帧为 null，此时所有第三方平台都会被判定为
        // 不支持。若这时就回退到 GlossMod，从详情页带 query 返回时会丢掉恢复出来的平台标签。
        if (!game) {
            return;
        }

        const currentOption = providerOptions.value.find((item) => {
            return item.value === activeProvider.value;
        });

        if (!currentOption?.supported) {
            activeProvider.value = "GlossMod";
        }
    },
    { immediate: true },
);

watch(activeProvider, syncActiveProviderQuery);

watch(
    () => route.query.provider,
    (value) => {
        const nextProvider = getQueryString(value);

        if (
            isExploreProviderQueryValue(nextProvider) &&
            nextProvider !== activeProvider.value
        ) {
            activeProvider.value = nextProvider;
        }
    },
);

async function openAiSettings() {
    await router.push({
        path: "/settings",
        hash: "#ai-config",
    });
}

function requestManualTranslate() {
    if (!hasAiConfiguration.value || translationBusy.value) {
        return;
    }

    manualTranslateToken.value += 1;
}

function cancelTranslate() {
    cancelTranslateToken.value += 1;
    translationBusy.value = false;
}

function handleTranslationLoadingChange(loading: boolean) {
    translationBusy.value = loading;
}
</script>
<template>
    <div class="mx-auto w-full max-w-[1560px] space-y-6">
        <header
            class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
        >
            <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div class="space-y-1">
                    <h1 class="text-xl font-semibold tracking-tight">
                        {{ $t("explore.common.pageTitle") }}
                    </h1>
                    <p class="text-sm text-muted-foreground">
                        {{ $t("explore.common.pageSubtitle") }}
                    </p>
                </div>
                <SelectGame />
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <Button
                    v-if="!hasAiConfiguration"
                    size="sm"
                    variant="outline"
                    @click="openAiSettings"
                >
                    <Languages class="size-4" />
                    {{ $t("explore.translation.configureAi") }}
                </Button>

                <template v-else>
                    <Button
                        size="sm"
                        variant="outline"
                        :disabled="translationBusy"
                        @click="requestManualTranslate"
                    >
                        <LoaderCircle
                            v-if="translationBusy"
                            class="size-4 animate-spin"
                        />
                        <Languages v-else class="size-4" />
                        {{
                            translationBusy
                                ? $t("explore.translation.translating")
                                : $t("explore.translation.manualTranslate")
                        }}
                    </Button>
                    <Button
                        v-if="translationBusy"
                        size="sm"
                        variant="ghost"
                        @click="cancelTranslate"
                    >
                        <X class="size-4" />
                        {{ $t("explore.translation.cancel") }}
                    </Button>
                </template>
                <Popover>
                    <PopoverTrigger as-child>
                        <Button
                            size="icon-sm"
                            variant="outline"
                            :aria-label="$t('explore.common.translationSettings')"
                        >
                            <IconSettings2 class="size-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" class="w-72 space-y-4">
                        <div class="space-y-1">
                            <div class="text-sm font-medium">
                                {{ $t("explore.common.translationSettings") }}
                            </div>
                            <p
                                v-if="!hasAiConfiguration"
                                class="text-xs leading-5 text-muted-foreground"
                            >
                                {{ $t("explore.common.translationNeedsAi") }}
                            </p>
                        </div>

                        <div class="space-y-3">
                            <div class="flex items-center justify-between gap-3">
                                <Label
                                    for="explore-auto-translate"
                                    class="text-sm font-normal"
                                >
                                    {{ $t("explore.translation.autoTranslate") }}
                                </Label>
                                <Switch
                                    id="explore-auto-translate"
                                    v-model="autoTranslate"
                                    :disabled="!hasAiConfiguration"
                                />
                            </div>

                            <div class="flex items-center justify-between gap-3">
                                <Label
                                    for="explore-show-original"
                                    class="text-sm font-normal"
                                >
                                    {{ $t("explore.translation.showOriginal") }}
                                </Label>
                                <Switch
                                    id="explore-show-original"
                                    v-model="showOriginal"
                                    :disabled="!hasAiConfiguration"
                                />
                            </div>
                        </div>

                        <Separator />

                        <div class="space-y-2">
                            <Label
                                for="explore-translation-locale"
                                class="text-sm font-normal"
                            >
                                {{ $t("explore.translation.targetLanguage") }}
                            </Label>
                            <Select
                                v-model="translationLocaleModel"
                                :disabled="!hasAiConfiguration"
                            >
                                <SelectTrigger
                                    id="explore-translation-locale"
                                    class="w-full"
                                >
                                    <SelectValue
                                        :placeholder="
                                            $t(
                                                'explore.translation.chooseLanguage',
                                            )
                                        "
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="item in languageOptions"
                                        :key="item.value"
                                        :value="item.value"
                                    >
                                        {{ item.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </header>

        <nav
            class="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1"
            :aria-label="$t('explore.common.providerTabs')"
        >
            <button
                v-for="item in providerOptions"
                :key="item.value"
                type="button"
                :disabled="!item.supported"
                :aria-current="
                    activeProvider === item.value ? 'page' : undefined
                "
                class="relative shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40"
                :class="
                    activeProvider === item.value
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                "
                @click="activeProvider = item.value"
            >
                {{ item.label }}
            </button>
        </nav>

        <GlossMods
            v-if="activeProvider === 'GlossMod'"
            :auto-translate="effectiveAutoTranslate"
            :translation-locale="translationLocaleModel"
            :show-original="showOriginal"
            :ai-base-url="settings.baseUrl"
            :ai-api-key="settings.apiKey"
            :ai-model-id="selectedAiModelId"
            :manual-translate-token="manualTranslateToken"
            :cancel-translate-token="cancelTranslateToken"
            @translation-loading-change="handleTranslationLoadingChange"
        />
        <ThirdPartyMods
            v-else
            :provider="activeThirdPartyProvider"
            :auto-translate="effectiveAutoTranslate"
            :translation-locale="translationLocaleModel"
            :show-original="showOriginal"
            :ai-base-url="settings.baseUrl"
            :ai-api-key="settings.apiKey"
            :ai-model-id="selectedAiModelId"
            :manual-translate-token="manualTranslateToken"
            :cancel-translate-token="cancelTranslateToken"
            @translation-loading-change="handleTranslationLoadingChange"
        />
    </div>
</template>
<style scoped></style>

