<script setup lang="ts">
import { ElMessage } from "element-plus-message";
import CustomCheckRuleFields from "@/components/custom-data/CustomCheckRuleFields.vue";
import CustomGameTypeFields from "@/components/custom-data/CustomGameTypeFields.vue";
import {
    cloneDefinition,
    createEmptyCheckRule,
    createEmptyGameCustomType,
    splitRelativePath,
    type TCustomGameCheckTypeTemplate,
    type TCustomGameModTypeTemplate,
} from "@/lib/custom-definition-utils";
import { saveLegacyCustomGameDefinition } from "@/lib/legacy-custom-data";

interface IGameExeDraft {
    name: string;
    rootPathText: string;
}

interface ICustomGameForm {
    GlossGameId: number | undefined;
    steamAppID: number | undefined;
    installdir: string;
    gameName: string;
    gameShowName: string;
    gameCoverImg: string;
    gameExeMode: "simple" | "advanced";
    gameExeText: string;
    gameExeList: IGameExeDraft[];
    startExeMode: "simple" | "advanced";
    startExeText: string;
    startExeList: IStartExe[];
    thunderstoreCommunity: string;
    modIoId: string;
    gamebananaId: string;
    curseforgeId: string;
    nexusGameId: string;
    nexusDomain: string;
    modTypeTemplate: TCustomGameModTypeTemplate;
    checkTypeTemplate: TCustomGameCheckTypeTemplate;
    unrealEngineBassPath: string;
    unrealEngineUseUE4SS: boolean;
    modTypes: IType[];
    checkRules: ICheckModType[];
}

const manager = useManager();

const dialogOpen = ref(false);

function createInitialForm(): ICustomGameForm {
    return {
        GlossGameId: undefined,
        steamAppID: undefined,
        installdir: "",
        gameName: "",
        gameShowName: "",
        gameCoverImg: "",
        gameExeMode: "simple",
        gameExeText: "",
        gameExeList: [],
        startExeMode: "simple",
        startExeText: "",
        startExeList: [],
        thunderstoreCommunity: "",
        modIoId: "",
        gamebananaId: "",
        curseforgeId: "",
        nexusGameId: "",
        nexusDomain: "",
        modTypeTemplate: "UnityGame.modType",
        checkTypeTemplate: "UnityGame.checkModType",
        unrealEngineBassPath: "",
        unrealEngineUseUE4SS: false,
        modTypes: [],
        checkRules: [],
    };
}

const form = reactive(createInitialForm());

const modTypeTemplateOptions: Array<{
    label: string;
    value: TCustomGameModTypeTemplate;
}> = [
    { label: "通用 Unity", value: "UnityGame.modType" },
    { label: "通用 Unity ILCPP2", value: "UnityGameILCPP2.modType" },
    { label: "通用虚幻", value: "UnrealEngine.modType" },
    { label: "完全自定义", value: "Custom" },
];

const checkTypeTemplateOptions: Array<{
    label: string;
    value: TCustomGameCheckTypeTemplate;
}> = [
    { label: "通用 Unity", value: "UnityGame.checkModType" },
    { label: "通用 Unity ILCPP2", value: "UnityGameILCPP2.checkModType" },
    { label: "通用虚幻", value: "UnrealEngine.checkModType" },
    { label: "完全自定义", value: "Custom" },
];

function resetForm() {
    Object.assign(form, cloneDefinition(createInitialForm()));
}

function addGameExe() {
    form.gameExeList.push({
        name: "",
        rootPathText: "",
    });
}

function removeGameExe(index: number) {
    form.gameExeList.splice(index, 1);
}

function addStartExe() {
    form.startExeList.push({
        name: "",
        exePath: "",
        options: "",
        cmd: "",
    });
}

function removeStartExe(index: number) {
    form.startExeList.splice(index, 1);
}

function getNextCustomTypeId() {
    const numberIds = form.modTypes
        .map((item) => Number(item.id))
        .filter((item) => Number.isFinite(item));

    return numberIds.length > 0 ? Math.max(...numberIds) + 1 : 1;
}

function addCustomGameType() {
    form.modTypes.push(createEmptyGameCustomType(getNextCustomTypeId()));
}

function removeCustomGameType(index: number) {
    const removedTypeId = String(form.modTypes[index]?.id ?? "");
    form.modTypes.splice(index, 1);
    form.checkRules = form.checkRules.filter((item) => {
        return String(item.TypeId ?? "") !== removedTypeId;
    });
}

function addCheckRule() {
    form.checkRules.push(
        createEmptyCheckRule(
            Number(form.modTypes[0]?.id ?? getNextCustomTypeId()),
        ),
    );
}

function removeCheckRule(index: number) {
    form.checkRules.splice(index, 1);
}

function parseOptionalNumber(value: string) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
        return undefined;
    }

    const parsed = Number(normalizedValue);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeGameExeList() {
    return form.gameExeList
        .map((item) => {
            return {
                name: item.name.trim(),
                rootPath: splitRelativePath(item.rootPathText),
            } satisfies IGameExe;
        })
        .filter((item) => item.name);
}

function normalizeStartExeList() {
    return form.startExeList
        .map((item) => {
            return {
                name: item.name.trim(),
                exePath: item.exePath?.trim() || undefined,
                options: item.options?.trim() || undefined,
                cmd: item.cmd?.trim() || undefined,
            } satisfies IStartExe;
        })
        .filter((item) => item.name);
}

function validateForm() {
    if (
        !form.GlossGameId ||
        !form.steamAppID ||
        !form.installdir.trim() ||
        !form.gameName.trim() ||
        !form.gameShowName.trim() ||
        !form.gameCoverImg.trim()
    ) {
        ElMessage.warning("请先填写完整的基础信息。");
        return false;
    }

    if (form.gameExeMode === "simple" && !form.gameExeText.trim()) {
        ElMessage.warning("请填写游戏主程序名称。");
        return false;
    }

    if (
        form.gameExeMode === "advanced" &&
        normalizeGameExeList().length === 0
    ) {
        ElMessage.warning("请至少添加一个游戏主程序配置。");
        return false;
    }

    if (form.startExeMode === "simple" && !form.startExeText.trim()) {
        ElMessage.warning("请填写启动方式。");
        return false;
    }

    if (
        form.startExeMode === "advanced" &&
        normalizeStartExeList().length === 0
    ) {
        ElMessage.warning("请至少添加一个启动方式。");
        return false;
    }

    if (form.modTypeTemplate === "Custom" && form.modTypes.length === 0) {
        ElMessage.warning("请至少添加一个自定义类型。");
        return false;
    }

    if (
        form.modTypeTemplate === "Custom" &&
        form.modTypes.some((item) => {
            return (
                !String(item.id).trim() ||
                !item.name.trim() ||
                !item.installPath.trim()
            );
        })
    ) {
        ElMessage.warning("请填写完整的自定义类型 ID、名称和安装路径。");
        return false;
    }

    if (form.checkTypeTemplate === "Custom" && form.checkRules.length === 0) {
        ElMessage.warning("请至少添加一个自定义识别规则。");
        return false;
    }

    if (
        form.checkTypeTemplate === "Custom" &&
        form.checkRules.some((item) => {
            return (
                item.TypeId === undefined ||
                item.TypeId === null ||
                item.Keyword.length === 0
            );
        })
    ) {
        ElMessage.warning("请填写完整的自定义识别规则。");
        return false;
    }

    const normalizedGameName = form.gameName.trim();
    const duplicateGame = manager.supportedGames.find((game) => {
        return (
            game.GlossGameId === Number(form.GlossGameId) ||
            game.steamAppID === Number(form.steamAppID) ||
            game.gameName === normalizedGameName
        );
    });

    if (duplicateGame) {
        ElMessage.warning("游戏 ID、Steam App ID 或内部名称与现有游戏重复。");
        return false;
    }

    return true;
}

function buildPayload() {
    const payload: IExpandsSupportedGames = {
        GlossGameId: Number(form.GlossGameId),
        steamAppID: Number(form.steamAppID),
        installdir: form.installdir.trim(),
        gameName: form.gameName.trim(),
        gameShowName: form.gameShowName.trim(),
        gameCoverImg: form.gameCoverImg.trim(),
        gameExe:
            form.gameExeMode === "simple"
                ? form.gameExeText.trim()
                : normalizeGameExeList(),
        startExe:
            form.startExeMode === "simple"
                ? form.startExeText.trim()
                : normalizeStartExeList(),
        modType:
            form.modTypeTemplate === "Custom"
                ? cloneDefinition(form.modTypes)
                : form.modTypeTemplate,
        checkModType:
            form.checkTypeTemplate === "Custom"
                ? cloneDefinition(form.checkRules)
                : form.checkTypeTemplate,
        unrealEngineData: {
            bassPath: form.unrealEngineBassPath.trim(),
            useUE4SS: form.unrealEngineUseUE4SS,
        },
    };

    const thunderstoreCommunity = form.thunderstoreCommunity.trim();
    if (thunderstoreCommunity) {
        payload.Thunderstore = {
            community_identifier: thunderstoreCommunity,
        };
    }

    const modIoId = parseOptionalNumber(form.modIoId);
    if (modIoId !== undefined) {
        payload.mod_io = modIoId;
    }

    const gamebananaId = parseOptionalNumber(form.gamebananaId);
    if (gamebananaId !== undefined) {
        payload.gamebanana = gamebananaId;
    }

    const curseforgeId = parseOptionalNumber(form.curseforgeId);
    if (curseforgeId !== undefined) {
        payload.curseforge = curseforgeId;
    }

    const nexusDomain = form.nexusDomain.trim();
    const nexusGameId = parseOptionalNumber(form.nexusGameId);
    if (nexusDomain || nexusGameId !== undefined) {
        payload.nexusMods = {
            game_domain_name: nexusDomain,
            game_id: nexusGameId ?? 0,
        };
    }

    return payload;
}

async function saveGame() {
    if (!validateForm()) {
        return;
    }

    try {
        await saveLegacyCustomGameDefinition(buildPayload());
        await manager.reloadSupportedGames();

        dialogOpen.value = false;
        resetForm();
        ElMessage.success("已保存自定义游戏。");
    } catch (error: unknown) {
        console.error("保存自定义游戏失败");
        console.error(error);
        ElMessage.error(
            error instanceof Error ? error.message : "保存自定义游戏失败。",
        );
    }
}

watch(dialogOpen, (opened) => {
    if (!opened) {
        resetForm();
    }
});
</script>

<template>
    <Dialog v-model:open="dialogOpen">
        <DialogTrigger as-child>
            <Button variant="outline">
                <IconPlus class="h-4 w-4" />
                新增游戏
            </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-5xl">
            <DialogHeader>
                <DialogTitle class="flex items-center gap-3"
                    >新增游戏
                    <Button size="sm" variant="outline" as-child>
                        <a
                            href="https://gmm.aoe.top/add-new-game"
                            target="_blank"
                            >申请新游戏</a
                        >
                    </Button>
                    <Button size="sm" variant="outline" as-child>
                        <a
                            href="https://www.bilibili.com/video/BV1Dvtp6REUP"
                            target="_blank"
                            >视频教程</a
                        >
                    </Button>
                </DialogTitle>
            </DialogHeader>

            <div class="grid gap-6 py-2">
                <div class="grid gap-4 md:grid-cols-2">
                    <div class="grid gap-2">
                        <Label>游戏 ID</Label>
                        <Input
                            v-model.number="form.GlossGameId"
                            type="number"
                            min="1"
                            placeholder="可在3DM Mod站的游戏页面中查看, 没有可创建"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label>Steam App ID</Label>
                        <Input
                            v-model.number="form.steamAppID"
                            type="number"
                            min="1"
                            placeholder="在steam商店的 APPID 页面 URL 中查看"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label>游戏目录名称</Label>
                        <Input
                            v-model="form.installdir"
                            placeholder="在 Steam 目录下游戏文件夹的名称"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label>内部名称</Label>
                        <Input
                            v-model="form.gameName"
                            placeholder="用于配置文件与目录名(不允许有空格)，建议使用英文"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label>显示名称</Label>
                        <Input
                            v-model="form.gameShowName"
                            placeholder="界面展示名称，可以包含空格，可以使用中文"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label>封面地址</Label>
                        <Input
                            v-model="form.gameCoverImg"
                            placeholder="请输入图片 URL"
                        />
                    </div>
                </div>

                <div class="grid gap-4 rounded-lg border p-4">
                    <Accordion collapsible>
                        <AccordionItem value="item-1">
                            <AccordionTrigger>Mod平台(可选)</AccordionTrigger>
                            <AccordionContent>
                                <div class="mb-4 text-sm text-muted-foreground">
                                    填写对应的内容,
                                    可在游览中直接游览并下载对应的Mod
                                </div>
                                <div class="grid gap-4 md:grid-cols-2">
                                    <div class="grid gap-2">
                                        <Label>Thunderstore Community</Label>
                                        <Input
                                            v-model="form.thunderstoreCommunity"
                                            placeholder="community_identifier"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label>Mod.io ID</Label>
                                        <Input
                                            v-model="form.modIoId"
                                            type="number"
                                            min="0"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label>GameBanana ID</Label>
                                        <Input
                                            v-model="form.gamebananaId"
                                            type="number"
                                            min="0"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label>CurseForge ID</Label>
                                        <Input
                                            v-model="form.curseforgeId"
                                            type="number"
                                            min="0"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label>Nexus Domain</Label>
                                        <Input
                                            v-model="form.nexusDomain"
                                            placeholder="例如：baldursgate3"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label>Nexus Game ID</Label>
                                        <Input
                                            v-model="form.nexusGameId"
                                            type="number"
                                            min="0"
                                        />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                <div class="grid gap-4 rounded-lg border p-4">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="text-sm font-medium">主程序定位</div>
                            <p class="text-xs text-muted-foreground">
                                简单模式填写 exe
                                名称，高级模式可兼容旧版多入口配置。
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <Label for="exe-advanced-mode">高级模式</Label>
                            <Switch
                                id="exe-advanced-mode"
                                :model-value="form.gameExeMode === 'advanced'"
                                @update:model-value="
                                    form.gameExeMode = $event
                                        ? 'advanced'
                                        : 'simple'
                                "
                            />
                        </div>
                    </div>

                    <div
                        v-if="form.gameExeMode === 'simple'"
                        class="grid gap-2"
                    >
                        <Label>游戏主程序名称</Label>
                        <Input
                            v-model="form.gameExeText"
                            placeholder="例如：game.exe"
                        />
                    </div>

                    <div v-else class="grid gap-3">
                        <div
                            v-for="(item, index) in form.gameExeList"
                            :key="`game-exe-${index}`"
                            class="grid gap-3 rounded-lg border p-3"
                        >
                            <div
                                class="flex items-center justify-between gap-2"
                            >
                                <div class="text-sm font-medium">
                                    主程序 {{ index + 1 }}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    @click="removeGameExe(index)"
                                >
                                    删除
                                </Button>
                            </div>
                            <div class="grid gap-2">
                                <Label>名称</Label>
                                <Input
                                    v-model="item.name"
                                    placeholder="例如：game.exe"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label>相对根路径</Label>
                                <Input
                                    v-model="item.rootPathText"
                                    placeholder="例如：Binaries/Win64"
                                />
                            </div>
                        </div>

                        <Button variant="outline" @click="addGameExe">
                            <IconPlus class="h-4 w-4" />
                            添加主程序
                        </Button>
                    </div>
                </div>

                <div class="grid gap-4 rounded-lg border p-4">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="text-sm font-medium">启动方式</div>
                            <p class="text-xs text-muted-foreground">
                                高级模式可配置多个启动项，兼容旧版 `startExe`
                                结构。
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <Label for="start-exe-advanced-mode"
                                >高级模式</Label
                            >
                            <Switch
                                id="start-exe-advanced-mode"
                                :model-value="form.startExeMode === 'advanced'"
                                @update:model-value="
                                    form.startExeMode = $event
                                        ? 'advanced'
                                        : 'simple'
                                "
                            />
                        </div>
                    </div>

                    <div
                        v-if="form.startExeMode === 'simple'"
                        class="grid gap-2"
                    >
                        <Label>启动程序</Label>
                        <Input
                            v-model="form.startExeText"
                            placeholder="例如：game.exe"
                        />
                    </div>

                    <div v-else class="grid gap-3">
                        <div
                            v-for="(item, index) in form.startExeList"
                            :key="`start-exe-${index}`"
                            class="grid gap-3 rounded-lg border p-3"
                        >
                            <div
                                class="flex items-center justify-between gap-2"
                            >
                                <div class="text-sm font-medium">
                                    启动项 {{ index + 1 }}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    @click="removeStartExe(index)"
                                >
                                    删除
                                </Button>
                            </div>
                            <div class="grid gap-2">
                                <Label>显示名称</Label>
                                <Input
                                    v-model="item.name"
                                    placeholder="例如：启动游戏"
                                />
                            </div>
                            <div class="grid gap-2 md:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label>相对路径</Label>
                                    <Input
                                        v-model="item.exePath"
                                        placeholder="例如：Binaries/Win64/game.exe"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label>命令</Label>
                                    <Input
                                        v-model="item.cmd"
                                        placeholder="可选，外部命令或快捷方式"
                                    />
                                </div>
                            </div>
                            <div class="grid gap-2">
                                <Label>启动参数</Label>
                                <Input
                                    v-model="item.options"
                                    placeholder="当前仅保存，后续可用于扩展"
                                />
                            </div>
                        </div>

                        <Button variant="outline" @click="addStartExe">
                            <IconPlus class="h-4 w-4" />
                            添加启动项
                        </Button>
                    </div>
                </div>

                <div class="grid gap-4 rounded-lg border p-4">
                    <div class="grid gap-4 md:grid-cols-2">
                        <div class="grid gap-2">
                            <Label>Mod 类型模板</Label>
                            <Select v-model="form.modTypeTemplate">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="item in modTypeTemplateOptions"
                                        :key="item.value"
                                        :value="item.value"
                                    >
                                        {{ item.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label>识别规则模板</Label>
                            <Select v-model="form.checkTypeTemplate">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="item in checkTypeTemplateOptions"
                                        :key="item.value"
                                        :value="item.value"
                                    >
                                        {{ item.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div
                        v-if="form.modTypeTemplate === 'UnrealEngine.modType'"
                        class="grid gap-4 md:grid-cols-2"
                    >
                        <div class="grid gap-2">
                            <Label>虚幻独特目录</Label>
                            <Input
                                v-model="form.unrealEngineBassPath"
                                placeholder="例如：ProjectName"
                            />
                        </div>
                        <div
                            class="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                            <div class="space-y-1">
                                <div class="text-sm font-medium">
                                    使用 UE4SS
                                </div>
                                <p class="text-xs text-muted-foreground">
                                    影响通用虚幻模板的默认安装逻辑。
                                </p>
                            </div>
                            <Switch v-model="form.unrealEngineUseUE4SS" />
                        </div>
                    </div>

                    <div
                        v-if="form.modTypeTemplate === 'Custom'"
                        class="grid gap-3"
                    >
                        <div class="flex items-center justify-between gap-2">
                            <div class="text-sm font-medium">
                                自定义类型列表
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                @click="addCustomGameType"
                            >
                                <IconPlus class="h-4 w-4" />
                                添加类型
                            </Button>
                        </div>

                        <div
                            v-for="(item, index) in form.modTypes"
                            :key="`custom-type-${String(item.id ?? index)}`"
                            class="grid gap-3 rounded-lg border p-3"
                        >
                            <div
                                class="flex items-center justify-between gap-2"
                            >
                                <div class="text-sm font-medium">
                                    自定义类型 {{ index + 1 }}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    @click="removeCustomGameType(index)"
                                >
                                    删除
                                </Button>
                            </div>
                            <CustomGameTypeFields
                                v-model="form.modTypes[index]"
                            />
                        </div>
                    </div>

                    <div
                        v-if="form.checkTypeTemplate === 'Custom'"
                        class="grid gap-3"
                    >
                        <div class="flex items-center justify-between gap-2">
                            <div class="text-sm font-medium">
                                自定义识别规则
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                @click="addCheckRule"
                            >
                                <IconPlus class="h-4 w-4" />
                                添加规则
                            </Button>
                        </div>

                        <div
                            v-for="(item, index) in form.checkRules"
                            :key="`check-rule-${String(item.TypeId ?? index)}`"
                            class="grid gap-3 rounded-lg border p-3"
                        >
                            <div
                                class="flex items-center justify-between gap-2"
                            >
                                <div class="text-sm font-medium">
                                    规则 {{ index + 1 }}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    @click="removeCheckRule(index)"
                                >
                                    删除
                                </Button>
                            </div>
                            <CustomCheckRuleFields
                                v-model="form.checkRules[index]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <DialogFooter>
                <Button
                    variant="outline"
                    @click="
                        dialogOpen = false;
                        resetForm();
                    "
                >
                    取消
                </Button>
                <Button @click="saveGame">保存</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<style scoped></style>
