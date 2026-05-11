<script setup lang="ts">
import { openUrl } from "@tauri-apps/plugin-opener";
import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { ElMessage } from "element-plus-message";
import { useI18n } from "vue-i18n";
import { Aria2Rpc, type IAria2RpcTask } from "@/lib/aria2-rpc";
import {
    hasThirdPartyMultipleFiles,
    queueThirdPartyModDownloadWithSelection,
} from "@/lib/download-file-selection";
import {
    findGlossDuplicateTasks,
    getGlossModPresence,
    type GlossDownloadPresence,
    type IGlossDownloadTaskMeta,
} from "@/lib/gloss-download";
import { PersistentStore } from "@/lib/persistent-store";
import {
    fetchThirdPartyModDetail,
    fetchThirdPartyMods,
    getThirdPartyProviderLabel,
    isThirdPartyProviderSupported,
    NexusModsAuthorizationError,
    type INexusModsFacetSelection,
    type IThirdPartyModDetail,
    type IThirdPartyModFacetOption,
    type IThirdPartyModFacets,
    type IThirdPartyModFile,
    type IThirdPartyModItem,
    type ThirdPartyDescriptionFormat,
    type ThirdPartyProvider,
} from "@/lib/third-party-mod-api";

const DEFAULT_PAGE_SIZE = "12";
const PAGE_SIZE_OPTIONS = ["12", "20", "36", "48"];
const NEXUS_FACET_ALL_VALUE = "all";
const EMPTY_POSTER =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
            <defs>
                <linearGradient id="remote-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#171310" />
                    <stop offset="55%" stop-color="#6b421f" />
                    <stop offset="100%" stop-color="#d7a562" />
                </linearGradient>
            </defs>
            <rect width="640" height="360" rx="24" fill="url(#remote-gradient)" />
            <circle cx="120" cy="90" r="72" fill="rgba(255,255,255,0.12)" />
            <circle cx="540" cy="290" r="96" fill="rgba(255,255,255,0.08)" />
            <text x="48" y="210" fill="#fff5df" font-size="34" font-family="Arial, sans-serif">Third Party Mod</text>
            <text x="48" y="252" fill="#ffe0a3" font-size="20" font-family="Arial, sans-serif">暂无可用封面</text>
        </svg>
    `);

interface IPageItem {
    key: string;
    label: string;
    page?: number;
    ellipsis?: boolean;
}

type IExploreDownloadState = GlossDownloadPresence | "missing";

interface IExploreDownloadStatus {
    state: IExploreDownloadState;
    label: string;
    progress: number;
}

const props = defineProps<{
    provider: ThirdPartyProvider;
}>();

const manager = useManager();
const settings = useSettings();
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
const markdownParser = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: true,
    typographer: true,
}).use(markdownItAnchor, {
    level: [1, 2, 3],
});

const mods = ref<IThirdPartyModItem[]>([]);
const nexusFacets = ref<IThirdPartyModFacets>(createEmptyThirdPartyModFacets());
const loading = ref(false);
const errorMessage = ref("");
const page = ref(1);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const isFiltersExpanded = ref(false);
const totalCount = ref(0);
const totalPages = ref(0);
const searchKeyword = ref("");
const selectedNexusCategory = ref(NEXUS_FACET_ALL_VALUE);
const selectedNexusLanguage = ref(NEXUS_FACET_ALL_VALUE);
const selectedNexusTag = ref(NEXUS_FACET_ALL_VALUE);
const queueingResourceKey = ref("");
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailError = ref("");
const selectedMod = ref<IThirdPartyModDetail | null>(null);
const taskSnapshots = ref<Record<string, IAria2RpcTask>>({});

let requestSequence = 0;
let detailRequestSequence = 0;
let refreshTaskSnapshotPending = false;
let taskSnapshotTimer: ReturnType<typeof globalThis.setInterval> | null = null;

const currentGame = computed(() => manager.managerGame);
const currentGameName = computed(() => {
    return currentGame.value?.gameShowName ?? currentGame.value?.gameName ?? "";
});
const providerLabel = computed(() => {
    return getThirdPartyProviderLabel(props.provider);
});
const isNexusModsProvider = computed(() => props.provider === "NexusMods");
const providerSupported = computed(() => {
    return isThirdPartyProviderSupported(currentGame.value, props.provider);
});
const renderedDescription = computed(() => {
    return renderDescription(
        selectedMod.value?.description ?? "",
        selectedMod.value?.descriptionFormat ?? "text",
    );
});
const hasActiveFilters = computed(() => {
    return Boolean(searchKeyword.value.trim() || hasActiveNexusFacets.value);
});
const hasActiveNexusFacets = computed(() => {
    if (!isNexusModsProvider.value) {
        return false;
    }

    return [
        selectedNexusCategory.value,
        selectedNexusLanguage.value,
        selectedNexusTag.value,
    ].some((value) => value !== NEXUS_FACET_ALL_VALUE);
});
const currentPageDownloads = computed(() => {
    return mods.value.reduce((total, item) => total + (item.downloads ?? 0), 0);
});
const currentPageFileCount = computed(() => {
    return mods.value.reduce(
        (total, item) => total + (item.filesCount ?? 0),
        0,
    );
});
const currentPageFileCountLabel = computed(() => {
    if (mods.value.some((item) => usesLazyFileLoading(item))) {
        return t("explore.status.pendingLoad");
    }

    return formatNumber(currentPageFileCount.value);
});
const shouldPollTaskSnapshots = computed(() => {
    return Object.values(downloadStatusMap.value).some((status) => {
        return ["active", "waiting", "paused"].includes(status.state);
    });
});
const downloadStatusMap = computed<Record<string, IExploreDownloadStatus>>(
    () => {
        return Object.fromEntries(
            mods.value.map((item) => [
                `${item.source}-${item.id}`,
                resolveDownloadStatus(item),
            ]),
        );
    },
);
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
        label: t("explore.summary.currentPageResources"),
        value: currentPageFileCountLabel.value,
    },
]);
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

    const sortedPages = [...pages]
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

watch(
    () => props.provider,
    () => {
        resetFilters();
        mods.value = [];
        errorMessage.value = "";
        closeDetail();
        void fetchMods();
    },
    { immediate: true },
);

watch(
    currentGame,
    () => {
        closeDetail();
        if (page.value !== 1) {
            page.value = 1;
            return;
        }

        void fetchMods();
    },
    { immediate: true },
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

watch([selectedNexusCategory, selectedNexusLanguage, selectedNexusTag], () => {
    if (!isNexusModsProvider.value) {
        return;
    }

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

watchDebounced(
    () => searchKeyword.value.trim(),
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
    },
);

onBeforeUnmount(() => {
    if (taskSnapshotTimer !== null) {
        globalThis.clearInterval(taskSnapshotTimer);
        taskSnapshotTimer = null;
    }
});

async function fetchMods() {
    if (!currentGame.value) {
        mods.value = [];
        nexusFacets.value = createEmptyThirdPartyModFacets();
        totalCount.value = 0;
        totalPages.value = 0;
        errorMessage.value = t("explore.messages.selectGameFirst");
        return;
    }

    if (!providerSupported.value) {
        mods.value = [];
        nexusFacets.value = createEmptyThirdPartyModFacets();
        totalCount.value = 0;
        totalPages.value = 0;
        errorMessage.value = t("explore.thirdParty.providerUnsupported", {
            provider: providerLabel.value,
        });
        return;
    }

    const currentRequestSequence = ++requestSequence;
    loading.value = true;
    errorMessage.value = "";

    try {
        const result = await fetchThirdPartyMods(
            props.provider,
            currentGame.value,
            {
                page: page.value,
                pageSize: Number(pageSize.value),
                searchText: searchKeyword.value.trim(),
                nexusModsFacets: getNexusModsFacetSelection(),
            },
            settings.nexusModsUser,
        );

        if (currentRequestSequence !== requestSequence) {
            return;
        }

        mods.value = result.items;
        nexusFacets.value = result.facets ?? createEmptyThirdPartyModFacets();
        totalCount.value = result.totalCount;
        totalPages.value = result.totalPages;

        if (result.totalPages > 0 && page.value > result.totalPages) {
            page.value = result.totalPages;
        }
    } catch (error: unknown) {
        if (currentRequestSequence !== requestSequence) {
            return;
        }

        mods.value = [];
        nexusFacets.value = createEmptyThirdPartyModFacets();
        totalCount.value = 0;
        totalPages.value = 0;
        errorMessage.value = toErrorMessage(
            error,
            t("explore.thirdParty.fetchFailed", {
                provider: providerLabel.value,
            }),
        );
    } finally {
        if (currentRequestSequence === requestSequence) {
            loading.value = false;
        }
    }
}

async function openModDetail(item: IThirdPartyModItem) {
    detailOpen.value = true;
    detailLoading.value = true;
    detailError.value = "";
    selectedMod.value = null;

    const currentDetailRequestSequence = ++detailRequestSequence;

    try {
        selectedMod.value = await loadModDetail(item);

        if (currentDetailRequestSequence !== detailRequestSequence) {
            return;
        }
    } catch (error: unknown) {
        if (currentDetailRequestSequence !== detailRequestSequence) {
            return;
        }

        detailError.value = toErrorMessage(
            error,
            t("explore.thirdParty.readDetailFailed", {
                provider: providerLabel.value,
            }),
        );
    } finally {
        if (currentDetailRequestSequence === detailRequestSequence) {
            detailLoading.value = false;
        }
    }
}

async function openLatestResource(item: IThirdPartyModItem) {
    if (!currentGame.value) {
        ElMessage.warning(t("explore.messages.noSelectedGame"));
        return;
    }

    if (!item.primaryFile && item.source !== "NexusMods") {
        ElMessage.warning(t("explore.messages.noAvailableResourceForMod"));
        return;
    }

    const resourceKey = `${item.source}-${item.id}-${item.primaryFile?.id ?? "latest"}`;
    queueingResourceKey.value = resourceKey;

    try {
        const detail = await loadModDetail(item);
        await queueDownload(detail);
    } catch (error: unknown) {
        console.error("提交第三方下载任务失败");
        console.error(error);

        if (await maybeRedirectForNexusAuth(error)) {
            return;
        }

        ElMessage.error(
            toErrorMessage(
                error,
                t("explore.thirdParty.submitDownloadFailed", {
                    provider: providerLabel.value,
                }),
            ),
        );
    } finally {
        if (queueingResourceKey.value === resourceKey) {
            queueingResourceKey.value = "";
        }
    }
}

async function loadModDetail(item: IThirdPartyModItem) {
    if (!currentGame.value) {
        throw new Error(t("explore.messages.noSelectedGame"));
    }

    return fetchThirdPartyModDetail(
        props.provider,
        currentGame.value,
        item.routeId,
        item.routeQuery,
        settings.nexusModsUser,
    );
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
    } catch (error: unknown) {
        console.error("刷新第三方下载状态失败");
        console.error(error);
    } finally {
        refreshTaskSnapshotPending = false;
    }
}

function toNumber(value?: string | number) {
    const normalized = Number(value ?? 0);

    return Number.isFinite(normalized) ? normalized : 0;
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

function getDownloadCriteria(
    mod: Pick<IThirdPartyModItem, "source" | "id" | "title">,
    file?: IThirdPartyModFile | null,
) {
    if (!file && mod.source !== "NexusMods") {
        return null;
    }

    return {
        sourceType: mod.source as sourceType,
        externalId: mod.id,
        resourceId: file?.id,
        downloadUrl: file?.downloadUrl,
        fileName: file?.name,
        modTitle: mod.title,
    };
}

function getMatchedTask(
    mod: Pick<IThirdPartyModItem, "source" | "id" | "title">,
    file?: IThirdPartyModFile | null,
) {
    const criteria = getDownloadCriteria(mod, file);

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

function resolveFileDownloadStatus(
    mod: Pick<IThirdPartyModItem, "source" | "id" | "title">,
    file?: IThirdPartyModFile | null,
): IExploreDownloadStatus {
    if (!file && mod.source !== "NexusMods") {
        return {
            state: "missing",
            label: t("explore.status.noResource"),
            progress: 0,
        };
    }

    const criteria = getDownloadCriteria(mod, file);

    if (!criteria) {
        return {
            state: "missing",
            label: t("explore.status.noResource"),
            progress: 0,
        };
    }

    const presence = getGlossModPresence(
        taskMetaMap.value,
        manager.managerModList,
        criteria,
    );
    const task = getMatchedTask(mod, file);

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

function resolveDownloadStatus(
    item: IThirdPartyModItem,
): IExploreDownloadStatus {
    return resolveFileDownloadStatus(item, item.primaryFile);
}

function getDownloadStatus(item: IThirdPartyModItem) {
    return (
        downloadStatusMap.value[`${item.source}-${item.id}`] ?? {
            state: "none",
            label: t("explore.status.addDownload"),
            progress: 0,
        }
    );
}

function shouldShowDownloadProgress(item: IThirdPartyModItem) {
    return ["active", "waiting", "paused"].includes(
        getDownloadStatus(item).state,
    );
}

function getFileDownloadStatus(
    mod: Pick<IThirdPartyModItem, "source" | "id" | "title">,
    file?: IThirdPartyModFile | null,
) {
    return resolveFileDownloadStatus(mod, file);
}

function getFileDownloadButtonLabel(
    mod: Pick<IThirdPartyModItem, "source" | "id" | "title">,
    file?: IThirdPartyModFile | null,
) {
    if (!file && mod.source !== "NexusMods") {
        return t("explore.status.noResource");
    }

    const resourceKey = `${mod.source}-${mod.id}-${file?.id ?? "latest"}`;

    if (queueingResourceKey.value === resourceKey) {
        return t("explore.status.submitting");
    }

    return getFileDownloadStatus(mod, file).label;
}

function isFileDownloadActionDisabled(
    mod: Pick<IThirdPartyModItem, "source" | "id" | "title">,
    file?: IThirdPartyModFile | null,
) {
    if (!file && mod.source !== "NexusMods") {
        return true;
    }

    const resourceKey = `${mod.source}-${mod.id}-${file?.id ?? "latest"}`;

    if (queueingResourceKey.value === resourceKey) {
        return true;
    }

    const status = getFileDownloadStatus(mod, file).state;

    return ["active", "waiting", "imported", "missing"].includes(status);
}

async function queueDownload(mod: IThirdPartyModDetail, fileId?: string) {
    if (!currentGame.value) {
        throw new Error(t("explore.messages.noSelectedGame"));
    }

    const normalizedFileId = fileId?.trim() ?? "";
    const queueKey = `${mod.source}-${mod.id}-${normalizedFileId || "latest"}`;
    queueingResourceKey.value = queueKey;

    try {
        const result = await queueThirdPartyModDownloadWithSelection({
            provider: props.provider,
            mod,
            fileId: normalizedFileId || undefined,
            gameName: currentGameName.value,
            managerModList: manager.managerModList,
            nexusUser: settings.nexusModsUser,
        });

        if (!result) {
            ElMessage.info(t("explore.messages.downloadFileCanceled"));
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
    } finally {
        if (queueingResourceKey.value === queueKey) {
            queueingResourceKey.value = "";
        }
    }
}

async function handleDownload(
    mod?: IThirdPartyModDetail | null,
    fileId?: string,
) {
    if (!mod) {
        ElMessage.warning(t("explore.messages.noDownloadableFile"));
        return;
    }

    try {
        await queueDownload(mod, fileId);
    } catch (error: unknown) {
        console.error("提交第三方下载任务失败");
        console.error(error);

        if (await maybeRedirectForNexusAuth(error)) {
            return;
        }

        ElMessage.error(
            toErrorMessage(
                error,
                t("explore.thirdParty.submitDownloadFailed", {
                    provider: providerLabel.value,
                }),
            ),
        );
    }
}

async function openModWebsite(item?: { website?: string | null } | null) {
    const targetUrl = item?.website?.trim() ?? "";

    if (!targetUrl) {
        ElMessage.warning(t("explore.messages.noOpenableWebsite"));
        return;
    }

    try {
        await openUrl(targetUrl);
    } catch (error: unknown) {
        console.error("打开第三方页面失败");
        console.error(error);
        ElMessage.error(t("explore.messages.openThirdPartyFailed"));
    }
}

async function maybeRedirectForNexusAuth(error: unknown) {
    if (!(error instanceof NexusModsAuthorizationError)) {
        return false;
    }

    ElMessage.warning(t("explore.messages.nexusAuthorizationRequired"));
    await router.push({
        path: "/settings",
        query: {
            nexusAuthAction: "login",
        },
    });
    return true;
}

function closeDetail() {
    detailOpen.value = false;
    detailLoading.value = false;
    detailError.value = "";
    selectedMod.value = null;
}

function createEmptyThirdPartyModFacets(): IThirdPartyModFacets {
    return {
        categoryName: [],
        languageName: [],
        tag: [],
    };
}

function getNexusFacetValue(value: string) {
    return value === NEXUS_FACET_ALL_VALUE ? "" : value;
}

function getNexusModsFacetSelection(): INexusModsFacetSelection | undefined {
    if (!isNexusModsProvider.value) {
        return undefined;
    }

    return {
        categoryName: getNexusFacetValue(selectedNexusCategory.value),
        languageName: getNexusFacetValue(selectedNexusLanguage.value),
        tag: getNexusFacetValue(selectedNexusTag.value),
    };
}

function resetFilters() {
    searchKeyword.value = "";
    pageSize.value = DEFAULT_PAGE_SIZE;
    selectedNexusCategory.value = NEXUS_FACET_ALL_VALUE;
    selectedNexusLanguage.value = NEXUS_FACET_ALL_VALUE;
    selectedNexusTag.value = NEXUS_FACET_ALL_VALUE;

    if (page.value !== 1) {
        page.value = 1;
    }
}

function handleCoverError(event: Event) {
    const imageElement = event.target as HTMLImageElement;

    imageElement.src = EMPTY_POSTER;
}

function formatNumber(value?: number) {
    return numberFormatter.value.format(value ?? 0);
}

function formatFacetOptionLabel(item: IThirdPartyModFacetOption) {
    return `${item.label}（${formatNumber(item.count)}）`;
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

function formatBytes(size?: number) {
    const normalized = Number(size ?? 0);

    if (!Number.isFinite(normalized) || normalized <= 0) {
        return t("explore.common.unknownSize");
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let current = normalized;
    let unitIndex = 0;

    while (current >= 1024 && unitIndex < units.length - 1) {
        current /= 1024;
        unitIndex += 1;
    }

    return `${current.toFixed(current >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getCoverUrl(item: IThirdPartyModItem) {
    return item.cover || EMPTY_POSTER;
}

function usesLazyFileLoading(item: IThirdPartyModItem) {
    return item.source === "NexusMods" && !item.primaryFile;
}

function getResourceCountLabel(item: IThirdPartyModItem) {
    if (usesLazyFileLoading(item)) {
        return t("explore.status.pendingLoad");
    }

    return t("explore.resources.count", { count: item.filesCount });
}

function getResourceSizeLabel(item: IThirdPartyModItem) {
    if (usesLazyFileLoading(item)) {
        return t("explore.resources.clickToLoad");
    }

    return item.primaryFile
        ? formatBytes(item.primaryFile.size)
        : t("explore.common.unknownSize");
}

function getPrimaryResourceName(item: IThirdPartyModItem) {
    if (usesLazyFileLoading(item)) {
        return t("explore.resources.loadAfterClick");
    }

    return item.primaryFile?.name || t("explore.resources.noResourceName");
}

function getDownloadButtonLabel(item: IThirdPartyModItem) {
    if (queueingResourceKey.value.startsWith(`${item.source}-${item.id}-`)) {
        return t("explore.status.submitting");
    }

    if (hasThirdPartyMultipleFiles(item)) {
        return t("explore.actions.selectFileDownload");
    }

    return getDownloadStatus(item).label;
}

function getDownloadButtonClass(item: IThirdPartyModItem) {
    if (queueingResourceKey.value.startsWith(`${item.source}-${item.id}-`)) {
        return "border-sky-500/40 bg-sky-500/10 text-sky-700 hover:bg-sky-500/15 dark:text-sky-200";
    }

    if (hasThirdPartyMultipleFiles(item)) {
        return "";
    }

    const status = getDownloadStatus(item).state;

    if (status === "missing") {
        return "border-muted bg-muted/40 text-muted-foreground";
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

    return "";
}

function isDownloadActionDisabled(item: IThirdPartyModItem) {
    if (queueingResourceKey.value.startsWith(`${item.source}-${item.id}-`)) {
        return true;
    }

    if (hasThirdPartyMultipleFiles(item)) {
        return false;
    }

    const status = getDownloadStatus(item).state;

    return ["active", "waiting", "imported", "missing"].includes(status);
}

function getModDownloadButtonLabel(mod: IThirdPartyModDetail) {
    if (queueingResourceKey.value.startsWith(`${mod.source}-${mod.id}-`)) {
        return t("explore.status.submitting");
    }

    if (hasThirdPartyMultipleFiles(mod)) {
        return t("explore.actions.selectFileDownload");
    }

    return getFileDownloadButtonLabel(mod, mod.primaryFile);
}

function isModDownloadActionDisabled(mod: IThirdPartyModDetail) {
    if (queueingResourceKey.value.startsWith(`${mod.source}-${mod.id}-`)) {
        return true;
    }

    if (hasThirdPartyMultipleFiles(mod)) {
        return mod.files.length === 0;
    }

    return isFileDownloadActionDisabled(mod, mod.primaryFile);
}

function getProgressBarClass(item: IThirdPartyModItem) {
    const status = getDownloadStatus(item).state;

    if (status === "active") {
        return "bg-sky-500";
    }

    if (status === "paused") {
        return "bg-amber-500";
    }

    return "bg-amber-400";
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

function toErrorMessage(error: unknown, fallbackMessage: string) {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return fallbackMessage;
}

function renderDescription(
    source: string,
    format: ThirdPartyDescriptionFormat,
) {
    if (!source.trim()) {
        return `<p class="empty-markdown">${t("explore.detail.noDescription")}</p>`;
    }

    if (format === "markdown") {
        return markdownParser.render(source);
    }

    if (format === "html") {
        return source;
    }

    return `<p>${escapeHtml(source).replace(/\n/gu, "<br />")}</p>`;
}

function escapeHtml(source: string) {
    return source
        .replace(/&/gu, "&amp;")
        .replace(/</gu, "&lt;")
        .replace(/>/gu, "&gt;")
        .replace(/"/gu, "&quot;")
        .replace(/'/gu, "&#39;");
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
                            {{ t("explore.thirdParty.noLocalGameProvider") }}
                        </Badge>
                    </div>
                    <div>
                        <h4 class="text-base font-semibold tracking-tight">
                            {{ providerLabel }}
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
                        <span>·</span>
                        <span>
                            {{
                                t("explore.thirdParty.currentPageDownloads", {
                                    count: formatNumber(currentPageDownloads),
                                })
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
                            :placeholder="t('explore.common.searchMods')"
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
                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

                    <template v-if="isNexusModsProvider">
                        <div>
                            <div class="text-sm font-medium">
                                {{ t("explore.filters.nexusCategory") }}
                            </div>
                            <Select
                                v-model="selectedNexusCategory"
                                :disabled="!nexusFacets.categoryName.length"
                            >
                                <SelectTrigger class="mt-2 w-full">
                                    <SelectValue
                                        :placeholder="
                                            t('explore.filters.allCategories')
                                        "
                                    />
                                </SelectTrigger>
                                <SelectContent class="max-h-72">
                                    <SelectItem :value="NEXUS_FACET_ALL_VALUE">
                                        {{ t("explore.filters.allCategories") }}
                                    </SelectItem>
                                    <SelectItem
                                        v-for="item in nexusFacets.categoryName"
                                        :key="item.value"
                                        :value="item.value"
                                    >
                                        {{ formatFacetOptionLabel(item) }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <div class="text-sm font-medium">
                                {{ t("explore.filters.nexusLanguage") }}
                            </div>
                            <Select
                                v-model="selectedNexusLanguage"
                                :disabled="!nexusFacets.languageName.length"
                            >
                                <SelectTrigger class="mt-2 w-full">
                                    <SelectValue
                                        :placeholder="
                                            t('explore.filters.allLanguages')
                                        "
                                    />
                                </SelectTrigger>
                                <SelectContent class="max-h-72">
                                    <SelectItem :value="NEXUS_FACET_ALL_VALUE">
                                        {{ t("explore.filters.allLanguages") }}
                                    </SelectItem>
                                    <SelectItem
                                        v-for="item in nexusFacets.languageName"
                                        :key="item.value"
                                        :value="item.value"
                                    >
                                        {{ formatFacetOptionLabel(item) }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <div class="text-sm font-medium">
                                {{ t("explore.filters.nexusTag") }}
                            </div>
                            <Select
                                v-model="selectedNexusTag"
                                :disabled="!nexusFacets.tag.length"
                            >
                                <SelectTrigger class="mt-2 w-full">
                                    <SelectValue
                                        :placeholder="
                                            t('explore.filters.allTags')
                                        "
                                    />
                                </SelectTrigger>
                                <SelectContent class="max-h-72">
                                    <SelectItem :value="NEXUS_FACET_ALL_VALUE">
                                        {{ t("explore.filters.allTags") }}
                                    </SelectItem>
                                    <SelectItem
                                        v-for="item in nexusFacets.tag"
                                        :key="item.value"
                                        :value="item.value"
                                    >
                                        {{ formatFacetOptionLabel(item) }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </template>
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
                    {{ t("explore.thirdParty.emptyDescription") }}
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
                            currentGameName
                                ? t("explore.thirdParty.listTitleWithGame", {
                                      game: currentGameName,
                                      provider: providerLabel,
                                  })
                                : t("explore.thirdParty.listTitle", {
                                      provider: providerLabel,
                                  })
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

            <section
                class="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
                <article
                    v-for="item in mods"
                    :key="`${item.source}-${item.id}`"
                    class="group overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/40"
                >
                    <div class="relative aspect-video overflow-hidden bg-muted">
                        <img
                            :src="getCoverUrl(item)"
                            :alt="item.title"
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
                                    {{ providerLabel }}
                                </Badge>
                                <Badge
                                    v-if="item.categories[0]"
                                    class="rounded-full border-white/30 bg-black/25 text-white"
                                >
                                    {{ item.categories[0] }}
                                </Badge>
                                <Badge
                                    v-if="
                                        item.primaryFile ||
                                        usesLazyFileLoading(item)
                                    "
                                    class="rounded-full border-white/30 bg-emerald-500/30 text-white"
                                >
                                    {{ getResourceCountLabel(item) }}
                                </Badge>
                                <Badge
                                    v-if="item.nsfw"
                                    class="rounded-full border-white/30 bg-rose-500/30 text-white"
                                >
                                    {{ t("explore.badges.nsfw") }}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4 p-4">
                        <div class="flex flex-col gap-2">
                            <div
                                class="line-clamp-2 text-base font-semibold leading-6"
                            >
                                {{ item.title }}
                            </div>
                            <div
                                v-if="item.tags.length"
                                class="flex flex-wrap gap-2"
                            >
                                <Badge
                                    v-for="tag in item.tags.slice(0, 5)"
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
                            <span>
                                {{
                                    t("explore.meta.author", {
                                        author:
                                            item.author ||
                                            t("explore.common.unknown"),
                                    })
                                }}
                            </span>
                            <span>·</span>
                            <span>
                                {{
                                    t("explore.meta.updated", {
                                        date: formatDate(item.updatedAt),
                                    })
                                }}
                            </span>
                            <span>·</span>
                            <span>
                                {{
                                    t("explore.meta.version", {
                                        version:
                                            item.version ||
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
                                    {{ formatNumber(item.downloads) }}
                                </div>
                            </div>
                            <div class="rounded-xl bg-muted/55 px-2 py-2.5">
                                <div class="text-muted-foreground">
                                    {{ t("explore.stats.likes") }}
                                </div>
                                <div class="mt-1 text-sm font-semibold">
                                    {{ formatNumber(item.likes) }}
                                </div>
                            </div>
                            <div class="rounded-xl bg-muted/55 px-2 py-2.5">
                                <div class="text-muted-foreground">
                                    {{ t("explore.stats.resources") }}
                                </div>
                                <div class="mt-1 text-sm font-semibold">
                                    {{ getResourceCountLabel(item) }}
                                </div>
                            </div>
                        </div>

                        <div
                            class="rounded-xl border bg-muted/20 px-3 py-3 text-xs text-muted-foreground"
                        >
                            <div
                                class="flex items-center justify-between gap-3"
                            >
                                <span>{{ getResourceCountLabel(item) }}</span>
                                <span>{{ getResourceSizeLabel(item) }}</span>
                            </div>
                            <div class="mt-2 line-clamp-1">
                                {{ getPrimaryResourceName(item) }}
                            </div>
                        </div>

                        <div
                            v-if="shouldShowDownloadProgress(item)"
                            class="space-y-2 rounded-xl border border-dashed px-3 py-3"
                        >
                            <div
                                class="flex items-center justify-between text-xs text-muted-foreground"
                            >
                                <span>{{ getDownloadStatus(item).label }}</span>
                                <span
                                    >{{
                                        getDownloadStatus(item).progress
                                    }}%</span
                                >
                            </div>
                            <div
                                class="h-2 overflow-hidden rounded-full bg-muted"
                            >
                                <div
                                    class="h-full rounded-full transition-all"
                                    :class="getProgressBarClass(item)"
                                    :style="{
                                        width: `${getDownloadStatus(item).progress}%`,
                                    }"
                                ></div>
                            </div>
                        </div>

                        <div class="grid grid-cols-3 items-start gap-2">
                            <Button
                                class="flex-1"
                                size="sm"
                                variant="outline"
                                @click="openModDetail(item)"
                            >
                                <IconExternalLink />
                                {{ t("explore.actions.viewDetail") }}
                            </Button>

                            <Button
                                class="w-full"
                                size="sm"
                                variant="outline"
                                @click="openModWebsite(item)"
                            >
                                {{ t("explore.actions.openWebsite") }}
                            </Button>
                            <Button
                                class="w-full"
                                size="sm"
                                :class="getDownloadButtonClass(item)"
                                :disabled="isDownloadActionDisabled(item)"
                                @click="openLatestResource(item)"
                            >
                                <IconDownload />
                                {{ getDownloadButtonLabel(item) }}
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

        <Dialog v-model:open="detailOpen">
            <DialogScrollContent class="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>
                        {{
                            selectedMod?.title ||
                            t("explore.detail.providerDetail", {
                                provider: providerLabel,
                            })
                        }}
                    </DialogTitle>
                    <DialogDescription>
                        {{
                            selectedMod
                                ? t("explore.detail.providerAuthor", {
                                      provider: providerLabel,
                                      author:
                                          selectedMod.author ||
                                          t("explore.common.unknownAuthor"),
                                  })
                                : t("explore.detail.viewProviderDetail", {
                                      provider: providerLabel,
                                  })
                        }}
                    </DialogDescription>
                </DialogHeader>

                <div v-if="detailLoading" class="space-y-3">
                    <div
                        class="h-10 w-2/3 animate-pulse rounded-xl bg-muted"
                    ></div>
                    <div class="h-56 animate-pulse rounded-2xl bg-muted"></div>
                    <div class="h-24 animate-pulse rounded-xl bg-muted"></div>
                </div>

                <div
                    v-else-if="detailError"
                    class="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
                >
                    {{ detailError }}
                </div>

                <div v-else-if="selectedMod" class="space-y-6">
                    <section
                        class="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"
                    >
                        <div
                            class="overflow-hidden rounded-2xl border bg-muted/50"
                        >
                            <img
                                :src="getCoverUrl(selectedMod)"
                                :alt="selectedMod.title"
                                class="h-full w-full object-cover"
                                @error="handleCoverError"
                            />
                        </div>

                        <div class="space-y-4">
                            <div class="flex flex-wrap gap-2">
                                <Badge class="rounded-full" variant="secondary">
                                    {{ providerLabel }}
                                </Badge>
                                <Badge
                                    v-if="selectedMod.version"
                                    class="rounded-full"
                                    variant="outline"
                                >
                                    {{
                                        t("explore.detail.versionBadge", {
                                            version: selectedMod.version,
                                        })
                                    }}
                                </Badge>
                                <Badge
                                    v-if="selectedMod.nsfw"
                                    class="rounded-full"
                                    variant="destructive"
                                >
                                    {{ t("explore.badges.nsfw") }}
                                </Badge>
                            </div>

                            <div
                                class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                            >
                                <div class="rounded-xl bg-muted/45 px-3 py-3">
                                    <div class="text-xs text-muted-foreground">
                                        {{ t("explore.stats.author") }}
                                    </div>
                                    <div class="mt-1 text-sm font-medium">
                                        {{
                                            selectedMod.author ||
                                            t("explore.common.emptyDash")
                                        }}
                                    </div>
                                </div>
                                <div class="rounded-xl bg-muted/45 px-3 py-3">
                                    <div class="text-xs text-muted-foreground">
                                        {{ t("explore.stats.downloads") }}
                                    </div>
                                    <div class="mt-1 text-sm font-medium">
                                        {{
                                            formatNumber(selectedMod.downloads)
                                        }}
                                    </div>
                                </div>
                                <div class="rounded-xl bg-muted/45 px-3 py-3">
                                    <div class="text-xs text-muted-foreground">
                                        {{ t("explore.stats.likes") }}
                                    </div>
                                    <div class="mt-1 text-sm font-medium">
                                        {{ formatNumber(selectedMod.likes) }}
                                    </div>
                                </div>
                                <div class="rounded-xl bg-muted/45 px-3 py-3">
                                    <div class="text-xs text-muted-foreground">
                                        {{ t("explore.stats.updatedAt") }}
                                    </div>
                                    <div class="mt-1 text-sm font-medium">
                                        {{ formatDate(selectedMod.updatedAt) }}
                                    </div>
                                </div>
                            </div>

                            <p class="text-sm leading-7 text-muted-foreground">
                                {{
                                    selectedMod.summary ||
                                    t("explore.detail.noSummary")
                                }}
                            </p>

                            <div
                                v-if="selectedMod.tags.length"
                                class="flex flex-wrap gap-2"
                            >
                                <Badge
                                    v-for="tag in selectedMod.tags"
                                    :key="tag"
                                    class="rounded-full"
                                    variant="outline"
                                >
                                    {{ tag }}
                                </Badge>
                            </div>

                            <div class="flex flex-wrap gap-2">
                                <Button
                                    variant="secondary"
                                    :disabled="
                                        isModDownloadActionDisabled(selectedMod)
                                    "
                                    @click="handleDownload(selectedMod)"
                                >
                                    {{ getModDownloadButtonLabel(selectedMod) }}
                                </Button>
                                <Button
                                    variant="outline"
                                    @click="openModWebsite(selectedMod)"
                                >
                                    {{ t("explore.actions.openWebsite") }}
                                </Button>
                            </div>
                        </div>
                    </section>

                    <section
                        class="prose prose-sm max-w-none rounded-2xl border border-border/70 p-5 dark:prose-invert"
                    >
                        <div v-html="renderedDescription"></div>
                    </section>

                    <section class="space-y-3">
                        <div class="text-base font-semibold">
                            {{ t("explore.detail.fileList") }}
                        </div>
                        <div
                            v-if="selectedMod.files.length === 0"
                            class="rounded-xl border border-dashed p-6 text-sm text-muted-foreground"
                        >
                            {{ t("explore.detail.noFiles") }}
                        </div>
                        <div v-else class="space-y-3">
                            <div
                                v-for="file in selectedMod.files"
                                :key="file.id"
                                class="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between"
                            >
                                <div class="space-y-1">
                                    <div class="font-medium">
                                        {{ file.name }}
                                    </div>
                                    <div class="text-sm text-muted-foreground">
                                        {{
                                            t("explore.detail.fileMeta", {
                                                version:
                                                    file.version ||
                                                    t(
                                                        "explore.detail.unlabeled",
                                                    ),
                                                size: formatBytes(file.size),
                                                date: formatDate(
                                                    file.createdAt,
                                                ),
                                            })
                                        }}
                                    </div>
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    <Button
                                        variant="secondary"
                                        :disabled="
                                            isFileDownloadActionDisabled(
                                                selectedMod,
                                                file,
                                            )
                                        "
                                        @click="
                                            handleDownload(selectedMod, file.id)
                                        "
                                    >
                                        {{
                                            getFileDownloadButtonLabel(
                                                selectedMod,
                                                file,
                                            )
                                        }}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        @click="
                                            openModWebsite({
                                                website: file.detailsUrl,
                                            })
                                        "
                                    >
                                        {{ t("explore.actions.openSource") }}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </DialogScrollContent>
        </Dialog>
    </div>
</template>

<style scoped>
:deep(.empty-markdown) {
    color: var(--muted-foreground);
}

:deep(.prose a) {
    color: var(--primary);
}
</style>
