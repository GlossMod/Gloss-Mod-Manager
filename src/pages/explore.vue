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
const activeProvider = ref<sourceType>("GlossMod");
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

watch(
    currentGame,
    () => {
        if (activeProvider.value === "GlossMod") {
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
    <div class="space-y-4">
        <Card>
            <CardHeader>
                <CardTitle class="flex flex-wrap items-center justify-between">
                    <div class="flex items-center gap-2">
                        <h3>游览 Mod</h3>
                        <SelectGame />
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button variant="outline">
                                    <icon-settings />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuGroup>
                                    <DropdownMenuItem
                                        class="flex items-center gap-2"
                                    >
                                        <Switch
                                            id="explore-auto-translate"
                                            v-model="autoTranslate"
                                            :disabled="!hasAiConfiguration"
                                        />
                                        <Label
                                            for="explore-auto-translate"
                                            class="text-sm font-medium"
                                        >
                                            {{
                                                $t(
                                                    "explore.translation.autoTranslate",
                                                )
                                            }}
                                        </Label>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        class="flex items-center gap-2"
                                    >
                                        <Switch
                                            id="explore-show-original"
                                            v-model="showOriginal"
                                            :disabled="!hasAiConfiguration"
                                        />
                                        <Label
                                            for="explore-show-original"
                                            class="text-sm font-medium"
                                        >
                                            {{
                                                $t(
                                                    "explore.translation.showOriginal",
                                                )
                                            }}
                                        </Label>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        class="flex items-center gap-2"
                                    >
                                        <Label
                                            for="explore-translation-locale"
                                            class="text-sm font-medium"
                                        >
                                            {{
                                                $t(
                                                    "explore.translation.targetLanguage",
                                                )
                                            }}
                                        </Label>
                                        <Select
                                            id="explore-translation-locale"
                                            v-model="translationLocaleModel"
                                            :disabled="!hasAiConfiguration"
                                        >
                                            <SelectTrigger class="h-9">
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
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            size="sm"
                            variant="secondary"
                            :disabled="!hasAiConfiguration || translationBusy"
                            @click="requestManualTranslate"
                        >
                            <LoaderCircle
                                v-if="translationBusy"
                                class="h-4 w-4 animate-spin"
                            />
                            <Languages v-else class="h-4 w-4" />
                            {{
                                translationBusy
                                    ? $t("explore.translation.translating")
                                    : $t("explore.translation.manualTranslate")
                            }}
                        </Button>
                        <Button
                            v-if="translationBusy"
                            size="sm"
                            variant="outline"
                            @click="cancelTranslate"
                        >
                            <X class="h-4 w-4" />
                            {{ $t("explore.translation.cancel") }}
                        </Button>
                        <Button
                            v-if="!hasAiConfiguration"
                            size="sm"
                            variant="outline"
                            @click="openAiSettings"
                        >
                            {{ $t("explore.translation.configureAi") }}
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent
                class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
            >
                <ToggleGroup type="single" v-model:model-value="activeProvider">
                    <ToggleGroupItem
                        v-for="item in providerOptions"
                        :key="item.value"
                        :value="item.value"
                        :disabled="!item.supported"
                    >
                        {{ item.label }}
                    </ToggleGroupItem>
                </ToggleGroup>
            </CardContent>
        </Card>

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
