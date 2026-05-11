<script setup lang="ts">
import { fetch as httpFetch } from "@tauri-apps/plugin-http";
import { ElMessage } from "element-plus-message";
import { useI18n } from "vue-i18n";
import { Aria2Rpc, type IAria2RpcTask } from "@/lib/aria2-rpc";
import {
    findGlossDuplicateTasks,
    getGlossModPresence,
    type GlossDownloadPresence,
    type IGlossDownloadTaskMeta,
} from "@/lib/gloss-download";
import {
    buildGlossOutputFileName,
    isGlossCloudDriveResource,
} from "@/lib/gloss-download-queue";
import {
    hasGlossMultipleResources,
    queueGlossModDownloadWithSelection,
} from "@/lib/download-file-selection";
import {
    fetchAllGlossGames,
    GLOSS_MOD_API_BASE_URL,
    GLOSS_MOD_KEY,
    GLOSS_MOD_WEB_BASE_URL,
    type IGlossGameListItem,
    type IGlossGameModType,
} from "@/lib/gloss-mod-api";
import { PersistentStore } from "@/lib/persistent-store";
const DEFAULT_PAGE_SIZE = "12";
const PAGE_SIZE_OPTIONS = ["12", "20", "36", "48"];
const EMPTY_POSTER =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
		<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
			<defs>
				<linearGradient id="gloss-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="#231815" />
					<stop offset="50%" stop-color="#8a4b08" />
					<stop offset="100%" stop-color="#f1c27d" />
				</linearGradient>
			</defs>
			<rect width="640" height="360" rx="24" fill="url(#gloss-gradient)" />
			<circle cx="120" cy="90" r="72" fill="rgba(255,255,255,0.12)" />
			<circle cx="540" cy="290" r="96" fill="rgba(255,255,255,0.08)" />
			<text x="48" y="210" fill="#fff5df" font-size="42" font-family="Arial, sans-serif">Gloss Mod</text>
			<text x="48" y="254" fill="#ffe0a3" font-size="22" font-family="Arial, sans-serif">暂无可用封面</text>
		</svg>
	`);
interface IGlossModListData {
    data: IGlossExploreMod[];
    count: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

interface IGlossModApiResponse<T> {
    success: boolean;
    msg: string;
    data: T | null;
}

interface IGlossExploreMod extends Omit<IMod, "mods_key" | "mods_showAD"> {
    mods_key?: string[] | string;
    mods_showAD?: boolean | number;
}

interface IPageItem {
    key: string;
    label: string;
    page?: number;
    ellipsis?: boolean;
}

type IExploreDownloadState = GlossDownloadPresence | "cloud" | "missing";

interface IExploreDownloadStatus {
    state: IExploreDownloadState;
    label: string;
    progress: number;
}

interface IGlossTypeOption {
    label: string;
    value: string;
}

const manager = useManager();
const router = useRouter();
const { t, locale } = useI18n();
const taskMetaMap = PersistentStore.useValue<
    Record<string, IGlossDownloadTaskMeta>
>("aria2TaskMetaMap", {});

const numberFormatter = computed(
    () => new Intl.NumberFormat(locale.value.replace(/_/gu, "-")),
);
const dateFormatter = computed(
    () =>
        new Intl.DateTimeFormat(locale.value.replace(/_/gu, "-"), {
            year: "numeric",
            month: "short",
            day: "numeric",
        }),
);
const originalFilterOptions = computed(() => [
    { label: t("explore.filters.allSources"), value: "all" },
    { label: t("explore.gloss.original.original"), value: "1" },
    { label: t("explore.gloss.original.secondary"), value: "2" },
    { label: t("explore.gloss.original.translation"), value: "3" },
    { label: t("explore.gloss.original.featured"), value: "4" },
]);
const timeFilterOptions = computed(() => [
    { label: t("explore.filters.allTime"), value: "all" },
    { label: t("explore.filters.today"), value: "1" },
    { label: t("explore.filters.lastWeek"), value: "2" },
    { label: t("explore.filters.lastMonth"), value: "3" },
    { label: t("explore.filters.lastThreeMonths"), value: "4" },
]);

const mods = ref<IGlossExploreMod[]>([]);
const loading = ref(false);
const errorMessage = ref("");
const queueingModId = ref("");
const taskSnapshots = ref<Record<string, IAria2RpcTask>>({});
const glossGameModTypeMap = ref<Record<string, IGlossGameModType[]>>({});
const glossGameTypeLoading = ref(false);
const glossGameTypeError = ref("");
const totalCount = ref(0);
const totalPages = ref(0);
const page = ref(1);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const isFiltersExpanded = ref(false);
const searchKeyword = ref("");
const tagKeyword = ref("");
const selectedOriginal = ref("all");
const selectedTime = ref("all");
const selectedType = ref("all");
const onlySupportGmm = ref(false);
const onlyLocal = ref(false);
const followCurrentGame = ref(true);

// 用请求序号兜住并发搜索，避免慢请求把新结果覆盖掉。
let requestSequence = 0;
let gameTypeRequestSequence = 0;
let refreshTaskSnapshotPending = false;
let taskSnapshotTimer: ReturnType<typeof globalThis.setInterval> | null = null;

const currentGame = computed(() => manager.managerGame);
const currentGameName = computed(
    () => currentGame.value?.gameShowName ?? currentGame.value?.gameName ?? "",
);
const currentGameId = computed<number | null>(() => {
    if (!followCurrentGame.value) {
        return null;
    }

    return currentGame.value?.GlossGameId ?? null;
});

// 游戏类型筛选改为使用 Gloss 游戏接口返回的 game_mod_types。
const currentTypeOptions = computed<IGlossTypeOption[]>(() => {
    if (!followCurrentGame.value || !currentGameId.value) {
        return [];
    }

    const gameTypes =
        glossGameModTypeMap.value[String(currentGameId.value)] ?? [];

    return gameTypes
        .map((item) => ({
            label:
                item.mods_type_name?.trim() ||
                t("explore.gloss.typeFallback", { id: item.id }),
            value: String(item.id),
        }))
        .filter((item) => Boolean(item.label && item.value));
});
const currentTypePlaceholder = computed(() => {
    if (!followCurrentGame.value || !currentGameId.value) {
        return t("explore.filters.noGameLimited");
    }

    if (glossGameTypeLoading.value) {
        return t("explore.filters.loadingTypes");
    }

    if (glossGameTypeError.value) {
        return t("explore.filters.typeLoadFailed");
    }

    return currentTypeOptions.value.length
        ? t("explore.filters.allTypes")
        : t("explore.filters.noTypesForCurrentGame");
});
const parsedTags = computed(() =>
    tagKeyword.value
        .split(/[，,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
);
const hasActiveFilters = computed(() => {
    return Boolean(
        searchKeyword.value.trim() ||
        parsedTags.value.length ||
        selectedOriginal.value !== "all" ||
        selectedTime.value !== "all" ||
        selectedType.value !== "all" ||
        onlySupportGmm.value ||
        onlyLocal.value ||
        currentGameId.value,
    );
});
const paginationItems = computed<IPageItem[]>(() => {
    if (totalPages.value <= 1) {
        return [];
    }

    const pages = new Set<number>([
        1,
        totalPages.value,
        page.value - 1,
        page.value,
        page.value + 1,
    ]);

    if (page.value <= 3) {
        pages.add(2);
        pages.add(3);
        pages.add(4);
    }

    if (page.value >= totalPages.value - 2) {
        pages.add(totalPages.value - 1);
        pages.add(totalPages.value - 2);
        pages.add(totalPages.value - 3);
    }

    const sortedPages = Array.from(pages)
        .filter((value) => value >= 1 && value <= totalPages.value)
        .sort((left, right) => left - right);

    const items: IPageItem[] = [];
    let previousPage = 0;

    for (const value of sortedPages) {
        if (value - previousPage > 1) {
            items.push({
                key: `ellipsis-${previousPage}-${value}`,
                label: "...",
                ellipsis: true,
            });
        }

        items.push({
            key: `page-${value}`,
            label: String(value),
            page: value,
        });
        previousPage = value;
    }

    return items;
});
const summaryCards = computed(() => [
    {
        label: t("explore.summary.totalResults"),
        value: formatNumber(totalCount.value),
    },
    {
        label: t("explore.summary.currentPage"),
        value: String(totalPages.value > 0 ? page.value : 0),
    },
    {
        label: t("explore.summary.totalPages"),
        value: String(totalPages.value),
    },
    {
        label: t("explore.summary.tagConditions"),
        value: String(parsedTags.value.length),
    },
]);
const shouldPollTaskSnapshots = computed(() => {
    return Object.values(taskMetaMap.value).some((meta) => {
        return ["active", "waiting", "paused"].includes(meta.taskStatus ?? "");
    });
});
const downloadStatusMap = computed<Record<string, IExploreDownloadStatus>>(
    () => {
        return Object.fromEntries(
            mods.value.map((item) => [
                String(item.id),
                resolveDownloadStatus(item),
            ]),
        );
    },
);

watch(
    currentTypeOptions,
    (list) => {
        if (selectedType.value === "all") {
            return;
        }

        if (!list.some((item) => item.value === selectedType.value)) {
            selectedType.value = "all";
        }
    },
    { immediate: true },
);

watchDebounced(
    () => [
        searchKeyword.value.trim(),
        parsedTags.value.join("|"),
        selectedOriginal.value,
        selectedTime.value,
        selectedType.value,
        onlySupportGmm.value,
        onlyLocal.value,
        followCurrentGame.value,
        currentGameId.value,
    ],
    () => {
        if (page.value !== 1) {
            page.value = 1;
            return;
        }

        void fetchMods();
    },
    {
        debounce: 350,
        maxWait: 1000,
        immediate: true,
    },
);

watch(page, () => {
    void fetchMods();
});

watch(pageSize, () => {
    if (page.value !== 1) {
        page.value = 1;
        return;
    }

    void fetchMods();
});

watch(
    shouldPollTaskSnapshots,
    (shouldPoll) => {
        if (shouldPoll) {
            void refreshTaskSnapshots();

            if (taskSnapshotTimer === null) {
                taskSnapshotTimer = globalThis.setInterval(() => {
                    void refreshTaskSnapshots();
                }, 2000);
            }

            return;
        }

        if (taskSnapshotTimer !== null) {
            globalThis.clearInterval(taskSnapshotTimer);
            taskSnapshotTimer = null;
        }

        taskSnapshots.value = {};
    },
    { immediate: true },
);

onMounted(() => {
    void fetchGlossGameModTypes();
});

onBeforeUnmount(() => {
    if (taskSnapshotTimer !== null) {
        globalThis.clearInterval(taskSnapshotTimer);
        taskSnapshotTimer = null;
    }
});

function buildListUrl() {
    const url = new URL(`${GLOSS_MOD_API_BASE_URL}/mods`);

    url.searchParams.set("page", String(page.value));
    url.searchParams.set("pageSize", pageSize.value);

    if (searchKeyword.value.trim()) {
        url.searchParams.set("search", searchKeyword.value.trim());
    }

    if (selectedOriginal.value !== "all") {
        url.searchParams.set("original", selectedOriginal.value);
    }

    if (selectedTime.value !== "all") {
        url.searchParams.set("time", selectedTime.value);
    }

    if (selectedType.value !== "all") {
        url.searchParams.set("gameType", selectedType.value);
    }

    if (currentGameId.value) {
        url.searchParams.set("gameId", String(currentGameId.value));
    }

    for (const tag of parsedTags.value) {
        url.searchParams.append("key", tag);
    }

    if (onlySupportGmm.value) {
        url.searchParams.set("support_gmm", "1");
    }

    if (onlyLocal.value) {
        url.searchParams.set("local", "1");
    }

    return url.toString();
}

function buildGlossGameModTypeMap(gameModTypes: IGlossGameModType[]) {
    return Object.fromEntries(
        gameModTypes.map((item) => [String(item.id), item]),
    );
}

async function fetchGlossGameModTypes() {
    if (!GLOSS_MOD_KEY) {
        glossGameModTypeMap.value = {};
        glossGameTypeError.value = t("explore.gloss.envMissing");
        return;
    }

    const currentRequestSequence = ++gameTypeRequestSequence;

    glossGameTypeLoading.value = true;
    glossGameTypeError.value = "";

    try {
        const games: IGlossGameListItem[] = await fetchAllGlossGames();

        if (currentRequestSequence !== gameTypeRequestSequence) {
            return;
        }

        glossGameModTypeMap.value = Object.fromEntries(
            games.map((item) => {
                const uniqueTypes = Object.values(
                    buildGlossGameModTypeMap(item.game_mod_types ?? []),
                );

                return [String(item.id), uniqueTypes];
            }),
        );
    } catch (error: unknown) {
        if (currentRequestSequence !== gameTypeRequestSequence) {
            return;
        }

        glossGameModTypeMap.value = {};
        glossGameTypeError.value =
            error instanceof Error
                ? error.message
                : t("explore.gloss.fetchTypesFailed");
        console.error("加载 Gloss 游戏类型失败");
        console.error(error);
    } finally {
        if (currentRequestSequence === gameTypeRequestSequence) {
            glossGameTypeLoading.value = false;
        }
    }
}

async function fetchMods() {
    if (!GLOSS_MOD_KEY) {
        mods.value = [];
        totalCount.value = 0;
        totalPages.value = 0;
        errorMessage.value = t("explore.gloss.envMissing");
        return;
    }

    const currentRequestSequence = ++requestSequence;

    loading.value = true;
    errorMessage.value = "";

    try {
        const response = await httpFetch(buildListUrl(), {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: GLOSS_MOD_KEY,
            },
        });
        const payload =
            (await response.json()) as IGlossModApiResponse<IGlossModListData>;

        if (currentRequestSequence !== requestSequence) {
            return;
        }

        if (!response.ok || !payload.success || !payload.data) {
            const message = payload.msg || t("explore.gloss.fetchFailed");

            throw new Error(
                message.includes("无权访问")
                    ? t("explore.gloss.authFailed")
                    : message,
            );
        }

        mods.value = payload.data.data ?? [];
        totalCount.value = payload.data.count ?? 0;
        totalPages.value = payload.data.totalPages ?? 0;

        if (
            payload.data.totalPages > 0 &&
            page.value > payload.data.totalPages
        ) {
            page.value = payload.data.totalPages;
        }
    } catch (error: unknown) {
        if (currentRequestSequence !== requestSequence) {
            return;
        }

        mods.value = [];
        totalCount.value = 0;
        totalPages.value = 0;
        errorMessage.value =
            error instanceof Error
                ? error.message
                : t("explore.gloss.fetchFailed");
    } finally {
        if (currentRequestSequence === requestSequence) {
            loading.value = false;
        }
    }
}

function formatNumber(value: number) {
    return numberFormatter.value.format(value);
}

function toNumber(value?: string | number) {
    const normalized = Number(value ?? 0);

    return Number.isFinite(normalized) ? normalized : 0;
}

function formatDate(value?: string) {
    if (!value) {
        return t("explore.common.unknownTime");
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return dateFormatter.value.format(parsed);
}

function resolveAssetUrl(path?: string) {
    if (!path) {
        return "";
    }

    if (/^https?:\/\//.test(path)) {
        return path;
    }

    const normalizedPath = path.startsWith("/")
        ? path
        : `/${path.replace(/^\/+/, "")}`;

    return `${GLOSS_MOD_WEB_BASE_URL}${normalizedPath}`;
}

function getCoverUrl(item: IGlossExploreMod) {
    return resolveAssetUrl(item.mods_image_url) || EMPTY_POSTER;
}

function getFallbackCoverUrl(item: IGlossExploreMod) {
    return resolveAssetUrl(item.game_imgUrl) || EMPTY_POSTER;
}

function handleCoverError(event: Event) {
    const imageElement = event.target as HTMLImageElement;
    const fallbackSrc = imageElement.dataset.fallbackSrc || EMPTY_POSTER;

    if (imageElement.dataset.fallbackApplied === "true") {
        imageElement.src = EMPTY_POSTER;
        return;
    }

    imageElement.dataset.fallbackApplied = "true";
    imageElement.src = fallbackSrc;
}

function getOriginalLabel(value: number) {
    const labelMap: Record<string, string> = {
        "1": t("explore.gloss.original.original"),
        "2": t("explore.gloss.original.secondary"),
        "3": t("explore.gloss.original.translation"),
        "4": t("explore.gloss.original.featured"),
    };

    return labelMap[String(value)] ?? t("explore.gloss.original.other");
}

function getLatestResource(item: IGlossExploreMod) {
    return (
        item.mods_resource.find(
            (resource) => resource.mods_resource_latest_version,
        ) ?? item.mods_resource[0]
    );
}

function isCloudDriveMod(item: IGlossExploreMod) {
    return isGlossCloudDriveResource(getLatestResource(item));
}

function getGlossDuplicateCriteria(item: IGlossExploreMod) {
    const latestResource = getLatestResource(item);

    if (!latestResource?.mods_resource_url) {
        return null;
    }

    return {
        modId: item.id,
        resourceId: latestResource.id,
        downloadUrl: latestResource.mods_resource_url,
        fileName: buildGlossOutputFileName(latestResource),
        modTitle: item.mods_title,
    };
}

function getMatchedTask(item: IGlossExploreMod) {
    const criteria = getGlossDuplicateCriteria(item);

    if (!criteria) {
        return null;
    }

    for (const match of findGlossDuplicateTasks(taskMetaMap.value, criteria)) {
        const task = taskSnapshots.value[match.gid];

        if (task && task.status !== "removed") {
            return task;
        }
    }

    return null;
}

function getTaskProgress(task?: IAria2RpcTask | null) {
    if (!task) {
        return 0;
    }

    const totalLength = toNumber(task.totalLength);

    if (totalLength <= 0) {
        return 0;
    }

    return Math.min(
        100,
        Math.round((toNumber(task.completedLength) / totalLength) * 100),
    );
}

function resolveDownloadStatus(item: IGlossExploreMod): IExploreDownloadStatus {
    const latestResource = getLatestResource(item);

    if (!latestResource?.mods_resource_url) {
        return {
            state: "missing",
            label: t("explore.status.noResource"),
            progress: 0,
        };
    }

    if (isGlossCloudDriveResource(latestResource)) {
        return {
            state: "cloud",
            label: t("explore.actions.openCloudDrive"),
            progress: 0,
        };
    }

    const criteria = getGlossDuplicateCriteria(item);

    if (!criteria) {
        return {
            state: "none",
            label: t("explore.status.addDownload"),
            progress: 0,
        };
    }

    const presence = getGlossModPresence(
        taskMetaMap.value,
        manager.managerModList,
        criteria,
    );
    const task = getMatchedTask(item);

    switch (presence.state) {
        case "active":
            return {
                state: "active",
                label: t("explore.status.downloading"),
                progress: getTaskProgress(task),
            };
        case "waiting":
            return {
                state: "waiting",
                label: t("explore.status.waiting"),
                progress: getTaskProgress(task),
            };
        case "paused":
            return {
                state: "paused",
                label: t("explore.status.paused"),
                progress: getTaskProgress(task),
            };
        case "error":
            return {
                state: "error",
                label: t("explore.status.failed"),
                progress: 0,
            };
        case "complete":
            return {
                state: "complete",
                label: t("explore.status.redownload"),
                progress: 100,
            };
        case "imported":
            return {
                state: "imported",
                label: t("explore.status.imported"),
                progress: 100,
            };
        default:
            return {
                state: "none",
                label: t("explore.status.addDownload"),
                progress: 0,
            };
    }
}

function getDownloadStatus(item: IGlossExploreMod) {
    return (
        downloadStatusMap.value[String(item.id)] ?? {
            state: "none",
            label: t("explore.status.addDownload"),
            progress: 0,
        }
    );
}

function getDownloadButtonLabel(item: IGlossExploreMod) {
    if (queueingModId.value === String(item.id)) {
        return t("explore.status.adding");
    }

    if (hasGlossMultipleResources(item)) {
        return t("explore.actions.selectResourceDownload");
    }

    return getDownloadStatus(item).label;
}

function shouldShowDownloadProgress(item: IGlossExploreMod) {
    return ["active", "waiting", "paused"].includes(
        getDownloadStatus(item).state,
    );
}

function isDownloadActionDisabled(item: IGlossExploreMod) {
    if (queueingModId.value === String(item.id)) {
        return true;
    }

    if (hasGlossMultipleResources(item)) {
        return false;
    }

    const status = getDownloadStatus(item).state;

    return ["active", "waiting", "imported", "missing"].includes(status);
}

function getDownloadButtonClass(item: IGlossExploreMod) {
    const status = getDownloadStatus(item).state;

    if (hasGlossMultipleResources(item)) {
        return "";
    }

    if (status === "active") {
        return "border-sky-500/40 bg-sky-500/10 text-sky-700 hover:bg-sky-500/15 dark:text-sky-200";
    }

    if (status === "waiting" || status === "paused") {
        return "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-200";
    }

    if (status === "complete" || status === "imported") {
        return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-200";
    }

    if (status === "error") {
        return "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15";
    }

    if (status === "cloud") {
        return "border-sky-500/30 bg-sky-500/8 text-sky-700 hover:bg-sky-500/15 dark:text-sky-200";
    }

    return "";
}

function getProgressBarClass(item: IGlossExploreMod) {
    const status = getDownloadStatus(item).state;

    if (status === "active") {
        return "bg-sky-500";
    }

    if (status === "paused") {
        return "bg-amber-500";
    }

    return "bg-amber-400";
}

async function refreshTaskSnapshots() {
    if (!shouldPollTaskSnapshots.value || refreshTaskSnapshotPending) {
        return;
    }

    refreshTaskSnapshotPending = true;

    try {
        const [activeTasks, waitingTasks, stoppedTasks] = await Promise.all([
            Aria2Rpc.tellActive(),
            Aria2Rpc.tellWaiting(0, 100),
            Aria2Rpc.tellStopped(0, 100),
        ]);

        taskSnapshots.value = Object.fromEntries(
            [...activeTasks, ...waitingTasks, ...stoppedTasks].map((task) => [
                task.gid,
                task,
            ]),
        );
    } catch (error) {
        console.error("刷新游览页下载状态失败");
        console.error(error);
    } finally {
        refreshTaskSnapshotPending = false;
    }
}

function getTags(item: IGlossExploreMod) {
    if (Array.isArray(item.mods_key)) {
        return item.mods_key.filter(Boolean);
    }

    if (typeof item.mods_key === "string") {
        return item.mods_key
            .split(/[，,\s]+/)
            .map((tag) => tag.trim())
            .filter(Boolean);
    }

    return [] as string[];
}

function resetFilters() {
    searchKeyword.value = "";
    tagKeyword.value = "";
    selectedOriginal.value = "all";
    selectedTime.value = "all";
    selectedType.value = "all";
    onlySupportGmm.value = false;
    onlyLocal.value = false;
    followCurrentGame.value = true;
    pageSize.value = DEFAULT_PAGE_SIZE;

    if (page.value !== 1) {
        page.value = 1;
    }
}

async function openModDetail(item: IGlossExploreMod) {
    try {
        await router.push({
            path: `/detail/${item.id}`,
        });
    } catch (error) {
        console.error(error);
        ElMessage.error(t("explore.gloss.openDetailFailed"));
    }
}

async function openLatestResource(item: IGlossExploreMod) {
    const latestResource = getLatestResource(item);

    if (!latestResource?.mods_resource_url) {
        ElMessage.warning(t("explore.messages.noAvailableResourceForMod"));
        return;
    }

    const queueKey = String(item.id);
    queueingModId.value = queueKey;

    try {
        const result = await queueGlossModDownloadWithSelection({
            mod: item,
            managerModList: manager.managerModList,
        });

        if (!result) {
            ElMessage.info(t("explore.messages.downloadResourceCanceled"));
            return;
        }

        if (
            ["created", "resumed", "retried", "exists"].includes(result.status)
        ) {
            void refreshTaskSnapshots();
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
    } catch (error) {
        console.error(error);
        ElMessage.error(
            error instanceof Error
                ? error.message
                : t("explore.messages.submitDownloadFailed"),
        );
    } finally {
        if (queueingModId.value === queueKey) {
            queueingModId.value = "";
        }
    }
}

function goToPage(targetPage: number) {
    if (
        targetPage < 1 ||
        targetPage > totalPages.value ||
        targetPage === page.value
    ) {
        return;
    }

    page.value = targetPage;
}
</script>

<template>
    <div class="space-y-5">
        <section class="overflow-hidden rounded-2xl border p-4">
            <div
                class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"
            >
                <div class="space-y-3">
                    <div class="flex flex-wrap items-center gap-2">
                        <Badge
                            v-if="currentGameName"
                            class="rounded-full"
                            variant="outline"
                        >
                            {{
                                t("explore.common.currentGame", {
                                    game: currentGameName,
                                })
                            }}
                        </Badge>
                        <Badge v-else class="rounded-full" variant="outline">
                            {{ t("explore.gloss.noLocalGameAllResults") }}
                        </Badge>
                        <Badge
                            v-if="onlySupportGmm"
                            class="rounded-full"
                            variant="outline"
                        >
                            {{ t("explore.gloss.onlySupportGmm") }}
                        </Badge>
                        <Badge
                            v-if="onlyLocal"
                            class="rounded-full"
                            variant="outline"
                        >
                            {{ t("explore.gloss.onlyLocal") }}
                        </Badge>
                    </div>
                    <div>
                        <h4 class="text-base font-semibold tracking-tight">
                            3DM Mods
                        </h4>
                    </div>
                    <div
                        class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                    >
                        <span>
                            {{
                                totalPages > 0
                                    ? t("explore.common.pageProgress", {
                                          page,
                                          total: totalPages,
                                      })
                                    : t("explore.common.noPaginationResult")
                            }}
                        </span>
                        <span>·</span>
                        <span>
                            {{
                                hasActiveFilters
                                    ? t("explore.common.filtersActive")
                                    : t("explore.common.filtersInactive")
                            }}
                        </span>
                        <span v-if="loading">
                            · {{ t("explore.common.updating") }}
                        </span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-105">
                    <div
                        v-for="item in summaryCards"
                        :key="item.label"
                        class="rounded-xl border border-border/60 bg-background/80 px-3 py-3 backdrop-blur-sm"
                    >
                        <div class="text-xs text-muted-foreground">
                            {{ item.label }}
                        </div>
                        <div class="mt-1 text-lg font-semibold tracking-tight">
                            {{ item.value }}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="space-y-4 rounded-2xl border p-4">
            <div
                class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
            >
                <div class="flex-1 flex gap-3 lg:max-w-2xl">
                    <div class="relative w-full">
                        <Input
                            v-model="searchKeyword"
                            class="pr-10"
                            :placeholder="t('explore.gloss.searchPlaceholder')"
                            @keydown.enter="fetchMods"
                        />
                        <IconSearch
                            class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        @click="isFiltersExpanded = !isFiltersExpanded"
                    >
                        <IconListFilter />
                        {{
                            isFiltersExpanded
                                ? t("explore.actions.collapseFilters")
                                : t("explore.actions.expandFilters")
                        }}
                    </Button>
                    <Button size="sm" variant="outline" @click="resetFilters">
                        <IconFilterX />
                        {{ t("explore.actions.resetSearch") }}
                    </Button>
                </div>
            </div>

            <div v-show="isFiltersExpanded" class="space-y-3 pt-3 border-t">
                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div>
                        <div class="text-sm font-medium">
                            {{ t("explore.filters.tag") }}
                        </div>
                        <Input
                            v-model="tagKeyword"
                            class="mt-2"
                            :placeholder="t('explore.filters.tagPlaceholder')"
                            @keydown.enter="fetchMods"
                        />
                    </div>

                    <div>
                        <div class="text-sm font-medium">
                            {{ t("explore.filters.sourceType") }}
                        </div>
                        <Select v-model="selectedOriginal">
                            <SelectTrigger class="mt-2 w-full">
                                <SelectValue
                                    :placeholder="
                                        t('explore.filters.allSources')
                                    "
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="item in originalFilterOptions"
                                    :key="item.value"
                                    :value="item.value"
                                >
                                    {{ item.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <div class="text-sm font-medium">
                            {{ t("explore.filters.publishTime") }}
                        </div>
                        <Select v-model="selectedTime">
                            <SelectTrigger class="mt-2 w-full">
                                <SelectValue
                                    :placeholder="t('explore.filters.allTime')"
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="item in timeFilterOptions"
                                    :key="item.value"
                                    :value="item.value"
                                >
                                    {{ item.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <div class="text-sm font-medium">
                            {{ t("explore.filters.gameType") }}
                        </div>
                        <Select
                            v-model="selectedType"
                            :disabled="!currentTypeOptions.length"
                        >
                            <SelectTrigger class="mt-2 w-full">
                                <SelectValue
                                    :placeholder="currentTypePlaceholder"
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {{ t("explore.filters.allTypes") }}
                                </SelectItem>
                                <SelectItem
                                    v-for="item in currentTypeOptions"
                                    :key="item.value"
                                    :value="item.value"
                                >
                                    {{ item.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <div class="text-sm font-medium">
                            {{ t("explore.filters.pageSize") }}
                        </div>
                        <Select v-model="pageSize">
                            <SelectTrigger class="mt-2 w-full">
                                <SelectValue
                                    :placeholder="
                                        t('explore.filters.choosePageSize')
                                    "
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="item in PAGE_SIZE_OPTIONS"
                                    :key="item"
                                    :value="item"
                                >
                                    {{
                                        t("explore.filters.perPageOption", {
                                            count: item,
                                        })
                                    }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div class="flex flex-wrap gap-4 pt-2">
                    <div class="flex items-center gap-2">
                        <Switch id="onlySupportGmm" v-model="onlySupportGmm" />
                        <label
                            for="onlySupportGmm"
                            class="text-sm font-medium"
                            >{{ t("explore.gloss.onlySupportGmm") }}</label
                        >
                    </div>
                    <div class="flex items-center gap-2">
                        <Switch id="onlyLocal" v-model="onlyLocal" />
                        <label for="onlyLocal" class="text-sm font-medium">{{
                            t("explore.gloss.onlyLocal")
                        }}</label>
                    </div>
                </div>
            </div>
        </section>

        <section
            v-if="errorMessage"
            class="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-5"
        >
            <div
                class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
                <div>
                    <div class="text-sm font-semibold text-destructive">
                        {{ t("explore.common.loadFailed") }}
                    </div>
                    <p class="mt-1 text-sm text-muted-foreground">
                        {{ errorMessage }}
                    </p>
                </div>
                <Button variant="outline" @click="fetchMods">
                    <IconRefreshCcw />
                    {{ t("explore.actions.retry") }}
                </Button>
            </div>
        </section>

        <section
            v-else-if="loading && !mods.length"
            class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
            <div
                v-for="item in 6"
                :key="item"
                class="overflow-hidden rounded-2xl border bg-background"
            >
                <div class="aspect-video animate-pulse bg-muted"></div>
                <div class="space-y-3 p-4">
                    <div class="h-5 w-2/3 animate-pulse rounded bg-muted"></div>
                    <div
                        class="h-4 w-full animate-pulse rounded bg-muted"
                    ></div>
                    <div class="h-4 w-5/6 animate-pulse rounded bg-muted"></div>
                    <div class="grid grid-cols-3 gap-2">
                        <div class="h-8 animate-pulse rounded bg-muted"></div>
                        <div class="h-8 animate-pulse rounded bg-muted"></div>
                        <div class="h-8 animate-pulse rounded bg-muted"></div>
                    </div>
                </div>
            </div>
        </section>

        <section
            v-else-if="!mods.length"
            class="rounded-2xl border border-dashed px-4 py-10 text-center"
        >
            <div class="mx-auto max-w-md">
                <div class="text-base font-semibold">
                    {{ t("explore.empty.title") }}
                </div>
                <p class="mt-2 text-sm leading-6 text-muted-foreground">
                    {{ t("explore.gloss.emptyDescription") }}
                </p>
                <div class="mt-5 flex justify-center">
                    <Button variant="outline" @click="resetFilters">
                        <IconFilterX />
                        {{ t("explore.actions.clearFilters") }}
                    </Button>
                </div>
            </div>
        </section>

        <template v-else>
            <section
                class="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
            >
                <div>
                    <div class="text-sm font-medium">
                        {{
                            currentGameId
                                ? t("explore.gloss.listTitleWithGame", {
                                      game: currentGameName,
                                  })
                                : t("explore.gloss.allListTitle")
                        }}
                    </div>
                    <div class="mt-1 text-xs text-muted-foreground">
                        {{
                            t("explore.common.totalResults", {
                                count: formatNumber(totalCount),
                            })
                        }}
                    </div>
                </div>
                <div
                    class="flex items-center gap-2 text-xs text-muted-foreground"
                >
                    <IconLoaderCircle
                        v-if="loading"
                        class="size-4 animate-spin"
                    />
                    <span>{{
                        totalPages > 0
                            ? t("explore.common.pageProgress", {
                                  page,
                                  total: totalPages,
                              })
                            : t("explore.common.noPagination")
                    }}</span>
                </div>
            </section>

            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <article
                    v-for="item in mods"
                    :key="item.id"
                    class="group overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/40"
                >
                    <div class="relative aspect-video overflow-hidden bg-muted">
                        <img
                            :src="getCoverUrl(item)"
                            :data-fallback-src="getFallbackCoverUrl(item)"
                            :alt="item.mods_title"
                            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            @error="handleCoverError"
                        />
                        <div
                            class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 via-black/20 to-transparent px-4 py-3 text-white"
                        >
                            <div
                                class="flex flex-wrap items-center gap-2 text-xs"
                            >
                                <Badge
                                    class="rounded-full border-white/30 bg-black/25 text-white"
                                >
                                    {{ item.game_name }}
                                </Badge>
                                <Badge
                                    class="rounded-full border-white/30 bg-black/25 text-white"
                                >
                                    {{ item.mods_type_name }}
                                </Badge>
                                <Badge
                                    class="rounded-full border-white/30 bg-black/25 text-white"
                                >
                                    {{ getOriginalLabel(item.mods_original) }}
                                </Badge>
                                <Badge
                                    v-if="item.support_gmm"
                                    class="rounded-full border-white/30 bg-emerald-500/30 text-white"
                                >
                                    {{ t("explore.gloss.supportGmm") }}
                                </Badge>
                                <Badge
                                    v-if="isCloudDriveMod(item)"
                                    class="rounded-full border-white/30 bg-sky-500/30 text-white"
                                >
                                    {{ t("explore.gloss.cloudDrive") }}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4 p-4">
                        <div class="flex flex-col gap-2">
                            <div
                                class="line-clamp-2 text-base font-semibold leading-6"
                            >
                                {{ item.mods_title }}
                            </div>
                            <div
                                class="flex flex-wrap gap-2"
                                v-if="getTags(item).length"
                            >
                                <Badge
                                    v-for="tag in getTags(item).slice(0, 5)"
                                    :key="tag"
                                    class="rounded-full"
                                    variant="outline"
                                >
                                    {{ tag }}
                                </Badge>
                            </div>
                        </div>

                        <div
                            class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                        >
                            <span>{{
                                t("explore.meta.author", {
                                    author:
                                        item.user_nickName ||
                                        item.mods_author ||
                                        t("explore.common.unknown"),
                                })
                            }}</span>
                            <span>·</span>
                            <span>{{
                                t("explore.meta.updated", {
                                    date: formatDate(item.mods_updateTime),
                                })
                            }}</span>
                            <span>·</span>
                            <span>
                                {{
                                    t("explore.meta.version", {
                                        version:
                                            item.mods_version ||
                                            getLatestResource(item)
                                                ?.mods_resource_version ||
                                            t("explore.common.unknown"),
                                    })
                                }}
                            </span>
                        </div>

                        <div class="grid grid-cols-3 gap-2 text-center text-xs">
                            <div class="rounded-xl bg-muted/55 px-2 py-2.5">
                                <div class="text-muted-foreground">
                                    {{ t("explore.stats.downloads") }}
                                </div>
                                <div class="mt-1 text-sm font-semibold">
                                    {{ formatNumber(item.mods_download_cnt) }}
                                </div>
                            </div>
                            <div class="rounded-xl bg-muted/55 px-2 py-2.5">
                                <div class="text-muted-foreground">
                                    {{ t("explore.stats.views") }}
                                </div>
                                <div class="mt-1 text-sm font-semibold">
                                    {{ formatNumber(item.mods_click_cnt) }}
                                </div>
                            </div>
                            <div class="rounded-xl bg-muted/55 px-2 py-2.5">
                                <div class="text-muted-foreground">
                                    {{ t("explore.stats.favorites") }}
                                </div>
                                <div class="mt-1 text-sm font-semibold">
                                    {{ formatNumber(item.mods_mark_cnt) }}
                                </div>
                            </div>
                        </div>

                        <div
                            class="rounded-xl border bg-muted/20 px-3 py-3 text-xs text-muted-foreground"
                        >
                            <div
                                class="flex items-center justify-between gap-3"
                            >
                                <span>
                                    {{
                                        t("explore.resources.count", {
                                            count: item.mods_resource.length,
                                        })
                                    }}
                                </span>
                                <span>
                                    {{
                                        getLatestResource(item)
                                            ?.mods_resource_size ||
                                        t("explore.common.unknownSize")
                                    }}
                                </span>
                            </div>
                            <div class="mt-2 line-clamp-1">
                                {{
                                    getLatestResource(item)
                                        ?.mods_resource_name ||
                                    t("explore.resources.noResourceName")
                                }}
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2 items-start">
                            <div class="space-y-1.5">
                                <Button
                                    class="w-full"
                                    size="sm"
                                    variant="outline"
                                    :class="getDownloadButtonClass(item)"
                                    :disabled="isDownloadActionDisabled(item)"
                                    @click="openLatestResource(item)"
                                >
                                    <IconDownload />
                                    {{ getDownloadButtonLabel(item) }}
                                </Button>
                                <div
                                    v-if="shouldShowDownloadProgress(item)"
                                    class="space-y-1"
                                >
                                    <div
                                        class="h-1.5 overflow-hidden rounded-full bg-muted"
                                    >
                                        <div
                                            class="h-full rounded-full transition-[width] duration-300"
                                            :class="getProgressBarClass(item)"
                                            :style="{
                                                width: `${getDownloadStatus(item).progress}%`,
                                            }"
                                        ></div>
                                    </div>
                                    <div
                                        class="flex items-center justify-between text-[11px] text-muted-foreground"
                                    >
                                        <span>
                                            {{ getDownloadStatus(item).label }}
                                        </span>
                                        <span>
                                            {{
                                                getDownloadStatus(item)
                                                    .progress
                                            }}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                class="flex-1"
                                size="sm"
                                @click="openModDetail(item)"
                            >
                                <IconExternalLink />
                                {{ t("explore.actions.viewDetail") }}
                            </Button>
                        </div>
                    </div>
                </article>
            </section>

            <section
                class="flex flex-col gap-4 rounded-2xl border px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
            >
                <div class="text-sm text-muted-foreground">
                    {{
                        t("explore.common.currentPageSummary", {
                            page,
                            totalPages,
                            totalCount: formatNumber(totalCount),
                        })
                    }}
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        :disabled="page <= 1"
                        @click="goToPage(page - 1)"
                    >
                        <IconChevronLeft />
                        {{ t("explore.actions.previousPage") }}
                    </Button>

                    <template v-for="item in paginationItems" :key="item.key">
                        <span
                            v-if="item.ellipsis"
                            class="px-2 text-sm text-muted-foreground"
                        >
                            {{ item.label }}
                        </span>
                        <Button
                            v-else
                            size="sm"
                            :variant="
                                item.page === page ? 'default' : 'outline'
                            "
                            @click="goToPage(item.page ?? 1)"
                        >
                            {{ item.label }}
                        </Button>
                    </template>

                    <Button
                        size="sm"
                        variant="outline"
                        :disabled="page >= totalPages"
                        @click="goToPage(page + 1)"
                    >
                        {{ t("explore.actions.nextPage") }}
                        <IconChevronRight />
                    </Button>
                </div>
            </section>
        </template>
    </div>
</template>
