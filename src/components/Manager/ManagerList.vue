<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { ElMessage } from "element-plus-message";
import { queueGlossModDownloadWithSelection } from "@/lib/download-file-selection";
import {
    clearManagerInternalDrag,
    INTERNAL_DRAG_THRESHOLD,
    managerDragKind,
    managerDraggingModId,
    managerDraggingTagName,
    startManagerModDrag,
} from "@/lib/manager-internal-drag";
import { useSettings } from "@/stores/settings";

const MANAGER_FALLBACK_COVER = "/imgs/logo.png";

interface IEditModForm {
    modName: string;
    modVersion: string;
    modAuthor: string;
    modWebsite: string;
    modType: number | string;
    modDesc: string;
    tagsText: string;
}

const manager = useManager();
const { managerGridEnabled } = storeToRefs(useSettings());
const showEditDialog = ref(false);
const showDeleteDialog = ref(false);
const showSortDialog = ref(false);
const editingModId = ref<number | null>(null);
const deletingModId = ref<number | null>(null);
const deleteTargetMod = ref<IModInfo | null>(null);
const sortingMod = ref<IModInfo | null>(null);
const sortTargetModId = ref<number | null>(null);
const sortPlacement = ref<"before" | "after">("after");
const sortTargetKeyword = ref("");
const dragTargetId = ref<number | null>(null);
const dragPosition = ref<"before" | "after">("before");
const tagDropTargetId = ref<number | null>(null);
const operatingIds = ref<number[]>([]);
const updateingIds = ref<number[]>([]);
const pendingModDragId = ref<number | null>(null);
const pendingPointerPosition = ref<{ x: number; y: number } | null>(null);
const editForm = reactive<IEditModForm>({
    modName: "",
    modVersion: "",
    modAuthor: "",
    modWebsite: "",
    modType: 99,
    modDesc: "",
    tagsText: "",
});

const sortTargetOptions = computed(() => {
    const activeSortingModId = sortingMod.value?.id ?? null;
    const keyword = sortTargetKeyword.value.trim().toLowerCase();

    return manager.orderedMods.filter((item) => {
        if (item.id === activeSortingModId) {
            return false;
        }

        if (!keyword) {
            return true;
        }

        return [
            item.modName,
            item.modVersion,
            item.modAuthor ?? "",
            item.fileName,
        ]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
    });
});

function getModStoragePath(modId: number) {
    return manager.getModStoragePath(modId);
}

async function open(item: IModInfo) {
    const path = await getModStoragePath(item.id);

    if (!path) {
        ElMessage.warning("当前没有可用的 Mod 储存目录。");
        return;
    }

    await FileHandler.openFolder(path);
}

function openEditDialog(item: IModInfo) {
    editingModId.value = item.id;
    editForm.modName = item.modName;
    editForm.modVersion = item.modVersion;
    editForm.modAuthor = item.modAuthor ?? "";
    editForm.modWebsite = item.modWebsite ?? "";
    editForm.modType = item.modType ?? 99;
    editForm.modDesc = item.modDesc ?? "";
    editForm.tagsText = (item.tags ?? []).map((tag) => tag.name).join(", ");
    showEditDialog.value = true;
}

function resetEditDialog() {
    editingModId.value = null;
    editForm.modName = "";
    editForm.modVersion = "";
    editForm.modAuthor = "";
    editForm.modWebsite = "";
    editForm.modType = 99;
    editForm.modDesc = "";
    editForm.tagsText = "";
}

function resetSortDialog() {
    showSortDialog.value = false;
    sortingMod.value = null;
    sortTargetModId.value = null;
    sortPlacement.value = "after";
    sortTargetKeyword.value = "";
}

function openSortDialog(item: IModInfo) {
    const defaultTarget = manager.orderedMods.find((candidate) => {
        return candidate.id !== item.id;
    });

    if (!defaultTarget) {
        ElMessage.info("当前没有可用于排序的其他 Mod。");
        return;
    }

    sortingMod.value = item;
    sortTargetKeyword.value = "";
    sortPlacement.value = "after";
    sortTargetModId.value = defaultTarget.id;
    showSortDialog.value = true;
}

async function saveEdit() {
    const modId = editingModId.value;

    if (!modId) {
        return;
    }

    try {
        await manager.saveEditedMod({
            modId,
            modName: editForm.modName,
            modVersion: editForm.modVersion,
            modAuthor: editForm.modAuthor,
            modWebsite: editForm.modWebsite,
            modType: editForm.modType,
            modDesc: editForm.modDesc,
            tagsText: editForm.tagsText,
        });
        showEditDialog.value = false;
        resetEditDialog();
        ElMessage.success("Mod 信息已更新。");
    } catch (error: unknown) {
        ElMessage.warning(
            error instanceof Error ? error.message : "更新 Mod 信息失败。",
        );
    }
}

async function confirmSortMove() {
    const currentSortingMod = sortingMod.value;
    const targetModId = sortTargetModId.value;

    if (!currentSortingMod || targetModId === null) {
        return;
    }

    const targetMod = manager.managerModList.find(
        (item) => item.id === targetModId,
    );

    if (!targetMod) {
        ElMessage.warning("未找到排序目标，请重新选择。");
        return;
    }

    try {
        await manager.moveModRelativeToTarget(
            currentSortingMod.id,
            targetModId,
            sortPlacement.value,
        );
        clearDragState();
        clearTagDropState();
        ElMessage.success(
            `已将 ${currentSortingMod.modName} 调整到 ${targetMod.modName} 的${sortPlacement.value === "after" ? "下方" : "上方"}。`,
        );
        resetSortDialog();
    } catch (error: unknown) {
        ElMessage.error(
            error instanceof Error ? error.message : "调整排序失败。",
        );
    }
}

async function deleteMod(item: IModInfo) {
    deleteTargetMod.value = item;
    showDeleteDialog.value = true;
}

function closeDeleteDialog(force = false) {
    if (!force && deletingModId.value !== null) {
        return;
    }

    showDeleteDialog.value = false;

    if (force) {
        deleteTargetMod.value = null;
    }
}

function getDeleteDescription(item: IModInfo) {
    return item.isInstalled
        ? `确定删除 ${item.modName} 吗？\n\n当前条目标记为已安装，删除只会移除本地缓存目录和列表记录，不会自动清理游戏目录中的文件。`
        : `确定删除 ${item.modName} 吗？此操作会删除本地缓存目录和列表记录。`;
}

async function confirmDeleteMod() {
    const item = deleteTargetMod.value;

    if (!item) {
        closeDeleteDialog(true);
        return;
    }

    deletingModId.value = item.id;

    try {
        await manager.removeModRecord(item.id);
        ElMessage.success(`已删除 ${item.modName}`);
        closeDeleteDialog(true);
    } catch (error: unknown) {
        ElMessage.error(
            error instanceof Error
                ? error.message
                : "删除 Mod 目录失败，请检查文件占用或权限设置。",
        );
    } finally {
        deletingModId.value = null;
    }
}

async function updateModType(item: IModInfo, nextType: unknown) {
    if (nextType === null || nextType === undefined) {
        return;
    }

    if (
        typeof nextType !== "string" &&
        typeof nextType !== "number" &&
        typeof nextType !== "bigint"
    ) {
        return;
    }

    try {
        const modName = await manager.updateModType(item.id, nextType);
        ElMessage.success(`已更新 ${modName} 的类型。`);
    } catch (error: unknown) {
        ElMessage.error(
            error instanceof Error ? error.message : "更新 Mod 类型失败。",
        );
    }
}

async function updateModInstalled(item: IModInfo, nextInstalled: unknown) {
    if (typeof nextInstalled !== "boolean") {
        return;
    }

    const previousInstalled = item.isInstalled;
    item.isInstalled = nextInstalled;
    startOperating(item.id);
    console.log(manager.managerGame);

    try {
        const type = manager.managerGame?.modType.find(
            (type) => String(type.id) === String(item.modType ?? ""),
        );
        if (nextInstalled) {
            if (typeof type?.install == "function") {
                try {
                    const res = await type.install(item);
                    if (typeof res == "boolean" && res == false) {
                        item.isInstalled = false;
                    }
                } catch (error) {
                    console.error(error);
                    ElMessage.error(`安装 ${item.modName} 失败：${error}`);
                    item.isInstalled = false;
                }
            }
        } else {
            if (typeof type?.uninstall == "function") {
                try {
                    const res = await type.uninstall(item);
                    if (typeof res == "boolean" && res == false) {
                        item.isInstalled = true;
                    }
                } catch (error) {
                    ElMessage.error(`卸载 ${item.modName} 失败：${error}`);
                    item.isInstalled = true;
                }
            }
        }

        if (item.isInstalled !== previousInstalled) {
            await manager.saveManagerData();
        }
    } finally {
        finishOperating(item.id);
    }
}

function clearDragState() {
    dragTargetId.value = null;
    dragPosition.value = "before";
    pendingModDragId.value = null;
    pendingPointerPosition.value = null;
}

function clearTagDropState() {
    tagDropTargetId.value = null;
}

function startOperating(modId: number) {
    if (!operatingIds.value.includes(modId)) {
        operatingIds.value = [...operatingIds.value, modId];
    }
}

function finishOperating(modId: number) {
    operatingIds.value = operatingIds.value.filter((item) => item !== modId);
}

function isOperating(modId: number) {
    return operatingIds.value.includes(modId);
}

function startUpdate(modId: number) {
    if (!updateingIds.value.includes(modId)) {
        updateingIds.value = [...updateingIds.value, modId];
    }
}

function finishUpdate(modId: number) {
    updateingIds.value = updateingIds.value.filter((item) => item !== modId);
}

function isUpdateing(modId: number) {
    return updateingIds.value.includes(modId);
}

function handleSelectionChange(event: Event, modId: number) {
    manager.toggleSelection(
        modId,
        (event.target as HTMLInputElement | null)?.checked ?? false,
    );
}

function getModCoverSrc(item: IModInfo) {
    return item.cover || MANAGER_FALLBACK_COVER;
}

function getSortTargetLabel(item: IModInfo) {
    return `${item.modName} · ${item.modVersion}`;
}

function getItemContainerClass(item: IModInfo) {
    const stateClass = getRowClass(item);

    return stateClass ? stateClass : "";
}

async function toggleTagOnMod(item: IModInfo, tagName: string) {
    try {
        const result = await manager.toggleTagOnMod(item.id, tagName);
        clearTagDropState();
        ElMessage.success(
            result.toggledOn
                ? `已为 ${result.modName} 添加标签：${tagName}`
                : `已从 ${result.modName} 移除标签：${tagName}`,
        );
    } catch (error: unknown) {
        clearTagDropState();
        ElMessage.error(
            error instanceof Error ? error.message : "更新标签失败。",
        );
    }
}

async function queueModUpdate(item: IModInfo) {
    if (item.from !== "GlossMod" || !item.webId) {
        ElMessage.warning("当前只有来自 Gloss 的 Mod 支持直接更新。");
        return;
    }

    startUpdate(item.id);

    try {
        const result = await queueGlossModDownloadWithSelection({
            modId: item.webId,
            managerModList: manager.managerModList,
            replaceLocalModId: item.id,
        });

        if (!result) {
            ElMessage.info("已取消选择下载资源。");
            return;
        }

        if (
            result.status === "created" ||
            result.status === "resumed" ||
            result.status === "retried"
        ) {
            ElMessage.success(result.message);
            return;
        }

        ElMessage.info(result.message);
    } catch (error: unknown) {
        console.error("提交更新下载失败");
        console.error(error);
        ElMessage.error(
            error instanceof Error ? error.message : "提交更新下载失败。",
        );
    } finally {
        finishUpdate(item.id);
    }
}

function handleModPointerDown(event: PointerEvent, modId: number) {
    if (manager.selectionMode) {
        return;
    }

    if (event.button !== 0) {
        return;
    }

    pendingModDragId.value = modId;
    pendingPointerPosition.value = {
        x: event.clientX,
        y: event.clientY,
    };
}

function handleRowPointerEnter(modId: number) {
    if (managerDragKind.value === "tag" && managerDraggingTagName.value) {
        tagDropTargetId.value = modId;
        return;
    }

    if (
        managerDragKind.value !== "mod" ||
        managerDraggingModId.value === null ||
        managerDraggingModId.value === modId
    ) {
        return;
    }

    dragTargetId.value = modId;
}

function handleRowPointerMove(event: PointerEvent, modId: number) {
    if (managerDragKind.value === "tag" && managerDraggingTagName.value) {
        tagDropTargetId.value = modId;
        return;
    }

    if (
        managerDragKind.value !== "mod" ||
        managerDraggingModId.value === null ||
        managerDraggingModId.value === modId
    ) {
        return;
    }

    dragTargetId.value = modId;
    const currentTarget = event.currentTarget as HTMLElement | null;

    if (!currentTarget) {
        dragPosition.value = "before";
        return;
    }

    const { top, height } = currentTarget.getBoundingClientRect();
    dragPosition.value = event.clientY > top + height / 2 ? "after" : "before";
}

function handleRowPointerLeave(modId: number) {
    if (tagDropTargetId.value === modId) {
        clearTagDropState();
    }

    if (dragTargetId.value === modId) {
        clearDragState();
    }
}

async function reorderDraggedMod(targetModId: number) {
    if (
        managerDraggingModId.value === null ||
        managerDraggingModId.value === targetModId
    ) {
        clearDragState();
        return;
    }

    try {
        await manager.moveModRelativeToTarget(
            managerDraggingModId.value,
            targetModId,
            dragPosition.value,
            manager.filteredMods.map((item) => item.id),
        );
        clearDragState();
        ElMessage.success("Mod 顺序已更新。");
    } catch (error: unknown) {
        clearDragState();
        ElMessage.error(
            error instanceof Error ? error.message : "调整 Mod 顺序失败。",
        );
    }
}

function handleWindowPointerMove(event: PointerEvent) {
    if (
        !pendingModDragId.value ||
        !pendingPointerPosition.value ||
        managerDragKind.value !== null
    ) {
        return;
    }

    const deltaX = event.clientX - pendingPointerPosition.value.x;
    const deltaY = event.clientY - pendingPointerPosition.value.y;

    if (Math.hypot(deltaX, deltaY) < INTERNAL_DRAG_THRESHOLD) {
        return;
    }

    startManagerModDrag(pendingModDragId.value);
}

function handleWindowPointerCancel() {
    clearDragState();
    clearTagDropState();

    if (managerDragKind.value === "mod") {
        clearManagerInternalDrag();
    }
}

function handleWindowPointerUp() {
    if (managerDragKind.value === "tag") {
        const tagName = managerDraggingTagName.value;
        const targetMod = manager.managerModList.find(
            (item) => item.id === tagDropTargetId.value,
        );

        if (tagName && targetMod) {
            void toggleTagOnMod(targetMod, tagName);
        } else {
            clearManagerInternalDrag();
        }

        clearTagDropState();
        clearDragState();
        return;
    }

    if (managerDragKind.value === "mod") {
        const targetModId = dragTargetId.value;

        if (targetModId !== null) {
            void reorderDraggedMod(targetModId);
        } else {
            clearManagerInternalDrag();
            clearDragState();
        }

        clearTagDropState();
        return;
    }

    clearDragState();
    clearTagDropState();
}

function getRowClass(item: IModInfo) {
    const classNames = [] as string[];

    if (manager.selectionIds.includes(item.id)) {
        classNames.push("bg-primary/5");
    }

    if (tagDropTargetId.value === item.id) {
        classNames.push("ring-1 ring-primary/40 bg-primary/5");
    }

    if (
        dragTargetId.value !== item.id ||
        managerDraggingModId.value === item.id
    ) {
        return classNames.join(" ");
    }

    classNames.push(
        dragPosition.value === "after"
            ? "border-b-2 border-primary"
            : "border-t-2 border-primary",
    );

    return classNames.join(" ");
}

onMounted(() => {
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);
});

onUnmounted(() => {
    window.removeEventListener("pointermove", handleWindowPointerMove);
    window.removeEventListener("pointerup", handleWindowPointerUp);
    window.removeEventListener("pointercancel", handleWindowPointerCancel);
});

watch(showSortDialog, (opened) => {
    if (!opened) {
        resetSortDialog();
    }
});
</script>
<template>
    <Card>
        <CardContent class="max-h-[calc(100vh-430px)] overflow-auto">
            <Table v-if="!managerGridEnabled">
                <TableHeader>
                    <TableRow>
                        <TableHead v-if="manager.selectionMode" class="w-12">
                            选择
                        </TableHead>
                        <TableHead>名称</TableHead>
                        <TableHead class="w-30">版本</TableHead>
                        <TableHead class="w-30">类型</TableHead>
                        <TableHead class="w-30">状态</TableHead>
                        <TableHead class="w-30">预览</TableHead>
                        <TableHead class="w-30">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow
                        v-for="item in manager.filteredMods"
                        :key="item.id"
                        :class="getRowClass(item)"
                        @pointerenter="handleRowPointerEnter(item.id)"
                        @pointermove="handleRowPointerMove($event, item.id)"
                        @pointerleave="handleRowPointerLeave(item.id)"
                    >
                        <TableCell v-if="manager.selectionMode">
                            <input
                                type="checkbox"
                                class="h-4 w-4 accent-primary"
                                :checked="
                                    manager.selectionIds.includes(item.id)
                                "
                                @change="handleSelectionChange($event, item.id)"
                            />
                        </TableCell>
                        <TableCell>
                            <div class="flex items-center gap-2">
                                <span
                                    v-if="!manager.selectionMode"
                                    class="inline-flex cursor-grab text-muted-foreground active:cursor-grabbing"
                                    @pointerdown="
                                        handleModPointerDown($event, item.id)
                                    "
                                >
                                    <IconGripVertical class="w-4 h-4" />
                                </span>
                                <Badge
                                    v-for="tag in item.tags"
                                    :key="tag.name"
                                    variant="outline"
                                >
                                    <div
                                        class="h-2.5 w-2.5 rounded-full"
                                        :style="{ backgroundColor: tag.color }"
                                    ></div>
                                    {{ tag.name }}
                                </Badge>
                                <span class="font-medium">{{
                                    item.modName
                                }}</span>
                                <Badge
                                    v-if="item.isUpdate"
                                    variant="outline"
                                    class="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                                >
                                    可更新
                                </Badge>
                            </div>
                        </TableCell>
                        <TableCell>{{ item.modVersion }}</TableCell>
                        <TableCell>
                            <Select
                                :model-value="item.modType"
                                :disabled="
                                    item.isInstalled || isOperating(item.id)
                                "
                                @update:model-value="
                                    updateModType(item, $event)
                                "
                            >
                                <SelectTrigger>
                                    <SelectValue></SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="type in manager.managerGame
                                            ?.modType"
                                        :key="type.id"
                                        :value="type.id"
                                    >
                                        {{ type.name }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell>
                            <div class="flex items-center gap-2">
                                <Switch
                                    :id="`is-installed-${item.id}`"
                                    :model-value="item.isInstalled"
                                    :disabled="isOperating(item.id)"
                                    @update:model-value="
                                        updateModInstalled(item, $event)
                                    "
                                />
                                <Label :for="`is-installed-${item.id}`">
                                    {{
                                        isOperating(item.id)
                                            ? "处理中"
                                            : item.isInstalled
                                              ? "已安装"
                                              : "未安装"
                                    }}
                                </Label>
                            </div>
                        </TableCell>
                        <TableCell>
                            <HoverCard>
                                <HoverCardTrigger as-child>
                                    <Button variant="ghost" size="icon">
                                        <IconEye class="w-4 h-4" />
                                    </Button>
                                </HoverCardTrigger>
                                <HoverCardContent class="w-80">
                                    <AsyncImage
                                        :src="getModCoverSrc(item)"
                                        :fallback-src="MANAGER_FALLBACK_COVER"
                                        :alt="`${item.modName} 封面`"
                                        class="h-auto w-full rounded-md object-cover"
                                    />
                                </HoverCardContent>
                            </HoverCard>
                        </TableCell>
                        <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        :disabled="
                                            deletingModId === item.id ||
                                            isUpdateing(item.id)
                                        "
                                    >
                                        <IconMenu class="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        @click="openEditDialog(item)"
                                    >
                                        编辑
                                        <DropdownMenuShortcut>
                                            <IconSquarePen />
                                        </DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem @click="open(item)">
                                        打开
                                        <DropdownMenuShortcut>
                                            <IconFolderOpen />
                                        </DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        :disabled="
                                            manager.managerModList.length < 2
                                        "
                                        @click="openSortDialog(item)"
                                    >
                                        调整排序
                                        <DropdownMenuShortcut>
                                            <IconGripVertical />
                                        </DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="
                                            item.from === 'GlossMod' &&
                                            item.webId
                                        "
                                        @click="queueModUpdate(item)"
                                    >
                                        {{
                                            isUpdateing(item.id)
                                                ? "更新中..."
                                                : "更新"
                                        }}
                                        <DropdownMenuShortcut>
                                            <IconRefreshCw
                                                :class="
                                                    isUpdateing(item.id)
                                                        ? 'animate-spin'
                                                        : ''
                                                "
                                            />
                                        </DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="item.modWebsite"
                                        as-child
                                    >
                                        <a
                                            :href="item.modWebsite"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            网址
                                            <DropdownMenuShortcut>
                                                <IconGlobe />
                                            </DropdownMenuShortcut>
                                        </a>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        :disabled="deletingModId === item.id"
                                        @click="deleteMod(item)"
                                    >
                                        删除
                                        <DropdownMenuShortcut>
                                            <IconTrash
                                                class="text-destructive"
                                            />
                                        </DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <div
                v-else
                class="grid gap-4 py-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
                <article
                    v-for="item in manager.filteredMods"
                    :key="item.id"
                    :class="getItemContainerClass(item)"
                    class="overflow-hidden rounded-xl border bg-card shadow-sm transition-colors"
                    @pointerenter="handleRowPointerEnter(item.id)"
                    @pointermove="handleRowPointerMove($event, item.id)"
                    @pointerleave="handleRowPointerLeave(item.id)"
                >
                    <div
                        class="relative aspect-video overflow-hidden bg-muted/20"
                    >
                        <AsyncImage
                            :src="getModCoverSrc(item)"
                            :fallback-src="MANAGER_FALLBACK_COVER"
                            :alt="`${item.modName} 封面`"
                            class="h-full w-full object-cover"
                        />
                        <Badge
                            v-if="item.isUpdate"
                            variant="outline"
                            class="absolute left-3 top-3 border-emerald-500/40 bg-emerald-500/10 text-white backdrop-blur"
                        >
                            可更新
                        </Badge>
                        <div
                            class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 via-black/20 to-transparent p-3"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <div
                                        class="truncate font-medium text-white"
                                    >
                                        {{ item.modName }}
                                    </div>
                                    <div class="text-xs text-white/80">
                                        {{ item.modVersion }}
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input
                                        v-if="manager.selectionMode"
                                        type="checkbox"
                                        class="h-4 w-4 accent-primary"
                                        :checked="
                                            manager.selectionIds.includes(
                                                item.id,
                                            )
                                        "
                                        @change="
                                            handleSelectionChange(
                                                $event,
                                                item.id,
                                            )
                                        "
                                    />
                                    <span
                                        v-if="!manager.selectionMode"
                                        class="inline-flex cursor-grab text-white/90 active:cursor-grabbing"
                                        @pointerdown="
                                            handleModPointerDown(
                                                $event,
                                                item.id,
                                            )
                                        "
                                    >
                                        <IconGripVertical class="w-4 h-4" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid gap-3 p-4">
                        <div
                            v-if="item.tags?.length"
                            class="flex flex-wrap gap-2"
                        >
                            <Badge
                                v-for="tag in item.tags"
                                :key="tag.name"
                                variant="outline"
                            >
                                <div
                                    class="h-2.5 w-2.5 rounded-full"
                                    :style="{ backgroundColor: tag.color }"
                                ></div>
                                {{ tag.name }}
                            </Badge>
                        </div>

                        <div class="flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <Label class="text-xs text-muted-foreground"
                                    >类型</Label
                                >
                                <Select
                                    :model-value="item.modType"
                                    :disabled="
                                        item.isInstalled || isOperating(item.id)
                                    "
                                    @update:model-value="
                                        updateModType(item, $event)
                                    "
                                >
                                    <SelectTrigger>
                                        <SelectValue></SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem
                                            v-for="type in manager.managerGame
                                                ?.modType"
                                            :key="type.id"
                                            :value="type.id"
                                        >
                                            {{ type.name }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div
                                class="flex items-center justify-between gap-3"
                            >
                                <div class="text-sm text-muted-foreground">
                                    {{
                                        isOperating(item.id)
                                            ? "处理中"
                                            : item.isInstalled
                                              ? "已安装"
                                              : "未安装"
                                    }}
                                </div>
                                <Switch
                                    :id="`grid-installed-${item.id}`"
                                    :model-value="item.isInstalled"
                                    :disabled="isOperating(item.id)"
                                    @update:model-value="
                                        updateModInstalled(item, $event)
                                    "
                                />
                            </div>

                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        :disabled="
                                            deletingModId === item.id ||
                                            isUpdateing(item.id)
                                        "
                                    >
                                        <IconMenu class="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        @click="openEditDialog(item)"
                                    >
                                        编辑
                                        <DropdownMenuShortcut>
                                            <IconSquarePen />
                                        </DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem @click="open(item)">
                                        打开
                                        <DropdownMenuShortcut>
                                            <IconFolderOpen />
                                        </DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        :disabled="
                                            manager.managerModList.length < 2
                                        "
                                        @click="openSortDialog(item)"
                                    >
                                        调整排序
                                        <DropdownMenuShortcut>
                                            <IconGripVertical />
                                        </DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="
                                            item.from === 'GlossMod' &&
                                            item.webId
                                        "
                                        @click="queueModUpdate(item)"
                                    >
                                        {{
                                            isUpdateing(item.id)
                                                ? "更新中..."
                                                : "更新"
                                        }}
                                        <DropdownMenuShortcut>
                                            <IconRefreshCw
                                                :class="
                                                    isUpdateing(item.id)
                                                        ? 'animate-spin'
                                                        : ''
                                                "
                                            />
                                        </DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        v-if="item.modWebsite"
                                        as-child
                                    >
                                        <a
                                            :href="item.modWebsite"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            网址
                                            <DropdownMenuShortcut>
                                                <IconGlobe />
                                            </DropdownMenuShortcut>
                                        </a>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        :disabled="deletingModId === item.id"
                                        @click="deleteMod(item)"
                                    >
                                        删除
                                        <DropdownMenuShortcut>
                                            <IconTrash
                                                class="text-destructive"
                                            />
                                        </DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </article>
            </div>
        </CardContent>
    </Card>
    <Dialog v-model:open="showEditDialog" modal>
        <DialogContent class="sm:max-w-xl" @escape-key-down="resetEditDialog">
            <DialogHeader>
                <DialogTitle>编辑 Mod</DialogTitle>
                <DialogDescription>
                    修改当前 Mod 的基础信息，保存后会立即写回本地配置。
                </DialogDescription>
            </DialogHeader>
            <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                    <Label for="mod-name">名称</Label>
                    <Input id="mod-name" v-model="editForm.modName" />
                </div>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div class="grid gap-2">
                        <Label for="mod-version">版本</Label>
                        <Input id="mod-version" v-model="editForm.modVersion" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="mod-type">类型</Label>
                        <Select v-model="editForm.modType">
                            <SelectTrigger id="mod-type">
                                <SelectValue></SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="type in manager.managerGame?.modType"
                                    :key="type.id"
                                    :value="type.id"
                                >
                                    {{ type.name }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div class="grid gap-2">
                        <Label for="mod-author">作者</Label>
                        <Input id="mod-author" v-model="editForm.modAuthor" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="mod-website">网站</Label>
                        <Input id="mod-website" v-model="editForm.modWebsite" />
                    </div>
                </div>
                <div class="grid gap-2">
                    <Label for="mod-tags">标签</Label>
                    <Input
                        id="mod-tags"
                        v-model="editForm.tagsText"
                        placeholder="多个标签请用逗号分隔"
                    />
                </div>
                <div class="grid gap-2">
                    <Label for="mod-desc">描述</Label>
                    <Textarea id="mod-desc" v-model="editForm.modDesc" />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" @click="showEditDialog = false">
                    取消
                </Button>
                <Button @click="saveEdit">保存</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    <Dialog v-model:open="showSortDialog" modal>
        <DialogContent class="sm:max-w-lg" @escape-key-down="resetSortDialog">
            <DialogHeader>
                <DialogTitle>调整 Mod 排序</DialogTitle>
                <DialogDescription>
                    选择一个目标 Mod，并决定把当前 Mod 放到它的上方或下方。
                </DialogDescription>
            </DialogHeader>
            <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                    <Label for="sort-current-mod">当前 Mod</Label>
                    <Input
                        id="sort-current-mod"
                        :model-value="sortingMod?.modName ?? ''"
                        disabled
                    />
                </div>
                <div class="grid gap-2">
                    <Label for="sort-target-search">目标筛选</Label>
                    <Input
                        id="sort-target-search"
                        v-model="sortTargetKeyword"
                        placeholder="输入名称、版本或作者筛选目标 Mod"
                    />
                </div>
                <div class="grid gap-2">
                    <Label for="sort-target-mod">排序目标</Label>
                    <Select v-model="sortTargetModId">
                        <SelectTrigger id="sort-target-mod">
                            <SelectValue
                                placeholder="请选择目标 Mod"
                            ></SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem
                                v-for="item in sortTargetOptions"
                                :key="item.id"
                                :value="item.id"
                            >
                                {{ getSortTargetLabel(item) }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <p class="text-xs text-muted-foreground">
                        目标列表按当前排序展示，便于精确定位插入位置。
                    </p>
                </div>
                <div class="grid gap-2">
                    <Label for="sort-placement">插入位置</Label>
                    <Select v-model="sortPlacement">
                        <SelectTrigger id="sort-placement">
                            <SelectValue></SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="before">放到目标上方</SelectItem>
                            <SelectItem value="after">放到目标下方</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" @click="resetSortDialog">取消</Button>
                <Button
                    :disabled="
                        !sortingMod ||
                        sortTargetOptions.length === 0 ||
                        sortTargetModId === null
                    "
                    @click="confirmSortMove"
                >
                    确认调整
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    <AlertDialog
        :open="showDeleteDialog"
        @update:open="(open: boolean) => !open && closeDeleteDialog()"
    >
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle> 确认删除 </AlertDialogTitle>
                <AlertDialogDescription class="whitespace-pre-line">
                    {{
                        deleteTargetMod
                            ? getDeleteDescription(deleteTargetMod)
                            : "未找到要删除的 Mod。"
                    }}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel :disabled="deletingModId !== null">
                    取消
                </AlertDialogCancel>
                <AlertDialogAction
                    :disabled="deletingModId !== null"
                    class="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60"
                    @click="confirmDeleteMod()"
                >
                    {{ deletingModId !== null ? "删除中..." : "确认删除" }}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>
<style scoped></style>
