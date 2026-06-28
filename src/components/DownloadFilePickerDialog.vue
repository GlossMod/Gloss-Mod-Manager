<script setup lang="ts">
import { storeToRefs } from "pinia";
import { cn } from "@/lib/utils";

const picker = useDownloadFilePickerStore();
const {
    open,
    title,
    description,
    note,
    items,
    selectedItemIds,
    multiple,
    confirmLabel,
    cancelLabel,
} = storeToRefs(picker);

watch(open, (opened) => {
    if (!opened) {
        picker.cancelPending();
    }
});

function handleSelect(itemId: string) {
    picker.selectItem(itemId);
}

function handleConfirm() {
    picker.confirmSelection();
}

function handleCancel() {
    picker.cancelPending();
}

function isSelected(itemId: string) {
    return selectedItemIds.value.includes(itemId);
}
</script>

<template>
    <Dialog v-model:open="open" modal>
        <DialogContent class="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>{{ title }}</DialogTitle>
                <DialogDescription>
                    {{ description }}
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <div
                    v-if="note"
                    class="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
                >
                    {{ note }}
                </div>

                <div class="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
                    <button
                        v-for="item in items"
                        :key="item.id"
                        type="button"
                        :class="
                            cn(
                                'w-full rounded-xl border px-4 py-4 text-left transition-colors',
                                isSelected(item.id)
                                    ? 'border-primary bg-primary/5 shadow-xs'
                                    : 'hover:border-primary/40 hover:bg-muted/30',
                            )
                        "
                        @click="handleSelect(item.id)"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="space-y-2">
                                <div class="flex flex-wrap items-center gap-2">
                                    <div class="text-sm font-medium">
                                        {{ item.title }}
                                    </div>
                                    <Badge
                                        v-for="badge in item.badges"
                                        :key="`${item.id}-${badge}`"
                                        class="rounded-full"
                                        variant="outline"
                                    >
                                        {{ badge }}
                                    </Badge>
                                </div>
                                <p
                                    class="whitespace-pre-line text-sm leading-6 text-muted-foreground"
                                >
                                    {{ item.description }}
                                </p>
                            </div>

                            <div
                                :class="
                                    cn(
                                        'shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                                        isSelected(item.id)
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border/70 text-muted-foreground',
                                    )
                                "
                            >
                                {{
                                    isSelected(item.id)
                                        ? multiple
                                            ? "已勾选"
                                            : "已选择"
                                        : multiple
                                          ? "点击勾选"
                                          : "点击选择"
                                }}
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="handleCancel">
                    {{ cancelLabel }}
                </Button>
                <Button
                    :disabled="selectedItemIds.length === 0"
                    @click="handleConfirm"
                >
                    {{ confirmLabel }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<style scoped></style>
