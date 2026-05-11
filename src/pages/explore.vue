<script setup lang="ts">
import {
    THIRD_PARTY_PROVIDER_OPTIONS,
    getThirdPartyProviderLabel,
    isThirdPartyProviderSupported,
    type ThirdPartyProvider,
} from "@/lib/third-party-mod-api";

const manager = useManager();
const activeProvider = ref<sourceType>("GlossMod");

const currentGame = computed(() => manager.managerGame);
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
</script>
<template>
    <div class="space-y-4">
        <Card>
            <CardHeader>
                <CardTitle class="flex flex-wrap items-center gap-2">
                    <h3>游览 Mod</h3>
                    <SelectGame />
                </CardTitle>
            </CardHeader>
            <CardContent class="flex flex-wrap gap-2">
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

        <GlossMods v-if="activeProvider === 'GlossMod'" />
        <ThirdPartyMods v-else :provider="activeThirdPartyProvider" />
    </div>
</template>
<style scoped></style>
