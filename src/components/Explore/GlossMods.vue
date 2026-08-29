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
import type { AppLocale } from "@/lang/locales";
import {
    getExploreTranslationErrorMessage,
    translateExploreItems,
    type IExploreTranslationEntry,
    type IExploreTranslationSourceItem,
} from "@/lib/explore-ai-translation";
import { PersistentStore } from "@/lib/persistent-store";
const DEFAULT_PAGE_SIZE = "12";
const PAGE_SIZE_OPTIONS = ["12", "20", "36", "48"];
const EMPTY_POSTER =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
		<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
			<rect width="640" height="400" fill="#e7e7e7" />
			<g fill="none" stroke="#b4b4b4" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
				<rect x="264" y="164" width="112" height="88" rx="10" />
				<path d="M264 226l30-26 26 22 30-28 26 22" />
			</g>
			<circle cx="300" cy="192" r="9" fill="#b4b4b4" />
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

type GlossSortKey =
    | "default"
    | "updatedAt"
    | "createdAt"
    | "downloads"
    | "views"
    | "favorites";

interface IGlossSortOption {
    label: string;
    value: GlossSortKey;
}

interface ITranslatedBadgeText {
    key: string;
    label: string;
}

const props = withDefaults(
    defineProps<{
        autoTranslate?: boolean;
        translationLocale?: AppLocale;
        showOriginal?: boolean;
        aiBaseUrl?: string;
        aiApiKey?: string;
        aiModelId?: string;
        manualTranslateToken?: number;
        cancelTranslateToken?: number;
    }>(),
    {
        autoTranslate: false,
        translationLocale: "en_US",
        showOriginal: false,
        aiBaseUrl: "",
        aiApiKey: "",
        aiModelId: "",
        manualTranslateToken: 0,
        cancelTranslateToken: 0,
    },
);

const emit = defineEmits<{
    (event: "translationLoadingChange", loading: boolean): void;
}>();

const manager = useManager();
const router = useRouter();
const route = useRoute();
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
const sortOptions = computed<IGlossSortOption[]>(() => [
    { label: t("explore.filters.sortDefault"), value: "default" },
    { label: t("explore.filters.sortUpdatedAt"), value: "updatedAt" },
    { label: t("explore.filters.sortCreatedAt"), value: "createdAt" },
    { label: t("explore.filters.sortDownloads"), value: "downloads" },
    { label: t("explore.filters.sortViews"), value: "views" },
    { label: t("explore.filters.sortFavorites"), value: "favorites" },
]);

const mods = ref<IGlossExploreMod[]>([]);
const loading = ref(false);
const errorMessage = ref("");
const translationLoading = ref(false);
const translationErrorMessage = ref("");
const translationMap = ref<Record<string, IExploreTranslationEntry>>({});
const manualTranslationVisible = ref(false);
const queueingModId = ref("");
const taskSnapshots = ref<Record<string, IAria2RpcTask>>({});
const glossGameModTypeMap = ref<Record<string, IGlossGameModType[]>>({});
const glossGameTypeLoading = ref(false);
const glossGameTypeError = ref("");
const totalCount = ref(0);
const totalPages = ref(0);
const page = ref(readPositiveIntegerQuery("gPage", 1));
const pageSize = ref(
    readAllowedQuery("gPageSize", PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE),
);
const jumpPageInput = ref(String(page.value));
const isFiltersExpanded = ref(false);
const searchKeyword = ref(readStringQuery("gSearch"));
const tagKeyword = ref(readStringQuery("gTags"));
const selectedOriginal = ref(
    readAllowedQuery("gOriginal", ["all", "1", "2", "3", "4"], "all"),
);
const selectedTime = ref(
    readAllowedQuery("gTime", ["all", "1", "2", "3", "4"], "all"),
);
const selectedType = ref(readStringQuery("gType") || "all");
const selectedSort = ref<GlossSortKey>(
    readAllowedQuery(
        "gSort",
        [
            "default",
            "updatedAt",
            "createdAt",
            "downloads",
            "views",
            "favorites",
        ],
        "default",
    ) as GlossSortKey,
);
const onlySupportGmm = ref(readBooleanQuery("gSupportGmm"));
const onlyLocal = ref(readBooleanQuery("gLocal"));
const followCurrentGame = ref(!readBooleanQuery("gAllGames"));

// 用请求序号兜住并发搜索，避免慢请求把新结果覆盖掉。
let requestSequence = 0;
let gameTypeRequestSequence = 0;
let translationRequestSequence = 0;
let refreshTaskSnapshotPending = false;
let taskSnapshotTimer: ReturnType<typeof globalThis.setInterval> | null = null;
let translationAbortController: AbortController | null = null;
let routeSyncPending = false;

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
const sortedMods = computed(() => {
    if (mods.value.length <= 1 || selectedSort.value === "default") {
        return mods.value;
    }

    return mods.value
        .map((item, index) => ({
            item,
            index,
        }))
        .sort((left, right) => {
            const result = compareGlossMods(
                left.item,
                right.item,
                selectedSort.value,
            );

            return result !== 0 ? result : left.index - right.index;
        })
        .map(({ item }) => item);
});
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
const translationRequestKey = computed(() => {
    return mods.value
        .map((item) =>
            JSON.stringify([
                item.id,
                item.mods_title,
                item.mods_desc ?? "",
                item.mods_type_name,
                getTags(item),
                getLatestResource(item)?.mods_resource_name ?? "",
            ]),
        )
        .join("|");
});
const shouldShowTranslations = computed(() => {
    return props.autoTranslate || manualTranslationVisible.value;
});

watch(
    currentTypeOptions,
    (list) => {
        if (selectedType.value === "all") {
            return;
        }

        // 类型列表还没加载出来时不要清空选择，否则会把 query 里恢复的 gType 冲掉。
        if (glossGameTypeLoading.value || list.length === 0) {
            return;
        }

        if (!list.some((item) => item.value === selectedType.value)) {
            selectedType.value = "all";
        }
    },
    { immediate: true },
);

watch(page, () => {
    jumpPageInput.value = String(page.value);
});

watch(
    () => [
        page.value,
        pageSize.value,
        searchKeyword.value,
        tagKeyword.value,
        selectedOriginal.value,
        selectedTime.value,
        selectedType.value,
        selectedSort.value,
        onlySupportGmm.value,
        onlyLocal.value,
        followCurrentGame.value,
    ],
    scheduleExploreRouteSync,
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
    ],
    (_values, previousValues) => {
        // 首次触发只拉取数据，保留 query 里恢复出来的页码与筛选条件。
        if (!previousValues) {
            void fetchMods();
            return;
        }

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

// 单独监听所管理的游戏本身，不用 currentGameId：后者混入了 followCurrentGame，
// 切换「全部游戏」会同时触发上面的筛选 watch，造成重复请求。
const managedGameId = computed(() => currentGame.value?.GlossGameId ?? null);

// 持久化注水会把 managerGame 由 null 补成真实游戏，null -> 游戏 这一次变化
// 不是用户切换游戏，不能重置页码，否则从详情页返回会跳回第一页。
watch(managedGameId, (_gameId, previousGameId) => {
    // 不跟随当前游戏时，游戏变化不影响列表结果，无需重新请求。
    if (!followCurrentGame.value) {
        return;
    }

    if (previousGameId === null) {
        void fetchMods();
        return;
    }

    if (page.value !== 1) {
        page.value = 1;
        return;
    }

    void fetchMods();
});

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
    () => [
        props.autoTranslate,
        props.translationLocale,
        props.aiBaseUrl,
        props.aiApiKey,
        props.aiModelId,
        translationRequestKey.value,
    ],
    () => {
        if (props.autoTranslate) {
            void refreshTranslations("auto");
            return;
        }

        clearTranslations();
    },
    { immediate: true },
);

watch(
    translationLoading,
    (loading) => {
        emit("translationLoadingChange", loading);
    },
    { immediate: true },
);

watch(
    () => props.manualTranslateToken,
    (token, previousToken) => {
        if (!token || token === previousToken) {
            return;
        }

        void refreshTranslations("manual");
    },
);

watch(
    () => props.cancelTranslateToken,
    (token, previousToken) => {
        if (!token || token === previousToken) {
            return;
        }

        cancelTranslations();
    },
);

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
    cancelTranslations();

    if (taskSnapshotTimer !== null) {
        globalThis.clearInterval(taskSnapshotTimer);
        taskSnapshotTimer = null;
    }
});

function readQueryValue(key: string) {
    const value = route.query[key];

    return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function readStringQuery(key: string) {
    return readQueryValue(key).trim();
}

function readPositiveIntegerQuery(key: string, fallback: number) {
    const value = Number(readQueryValue(key));

    return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function readAllowedQuery<T extends string>(
    key: string,
    allowedValues: readonly T[],
    fallback: T,
) {
    const value = readQueryValue(key);

    return allowedValues.includes(value as T) ? (value as T) : fallback;
}

function readBooleanQuery(key: string) {
    return readQueryValue(key) === "1";
}

function setQueryValue(
    query: Record<string, string | string[]>,
    key: string,
    value: string,
    defaultValue = "",
) {
    if (!value || value === defaultValue) {
        delete query[key];
        return;
    }

    query[key] = value;
}

function cloneRouteQuery() {
    const query: Record<string, string | string[]> = {};

    for (const [key, value] of Object.entries(route.query)) {
        if (typeof value === "string") {
            query[key] = value;
        } else if (Array.isArray(value)) {
            query[key] = value.filter(
                (item): item is string => typeof item === "string",
            );
        }
    }

    return query;
}

function normalizeQuery(query: Record<string, unknown>) {
    return JSON.stringify(
        Object.keys(query)
            .sort()
            .map((key) => [key, query[key]]),
    );
}

function scheduleExploreRouteSync() {
    if (routeSyncPending) {
        return;
    }

    routeSyncPending = true;
    globalThis.queueMicrotask(() => {
        routeSyncPending = false;
        syncExploreRouteQuery();
    });
}

function syncExploreRouteQuery() {
    if (route.path !== "/explore") {
        return;
    }

    const nextQuery = cloneRouteQuery();

    setQueryValue(nextQuery, "gPage", String(page.value), "1");
    setQueryValue(nextQuery, "gPageSize", pageSize.value, DEFAULT_PAGE_SIZE);
    setQueryValue(nextQuery, "gSearch", searchKeyword.value.trim());
    setQueryValue(nextQuery, "gTags", tagKeyword.value.trim());
    setQueryValue(nextQuery, "gOriginal", selectedOriginal.value, "all");
    setQueryValue(nextQuery, "gTime", selectedTime.value, "all");
    setQueryValue(nextQuery, "gType", selectedType.value, "all");
    setQueryValue(nextQuery, "gSort", selectedSort.value, "default");
    setQueryValue(nextQuery, "gSupportGmm", onlySupportGmm.value ? "1" : "");
    setQueryValue(nextQuery, "gLocal", onlyLocal.value ? "1" : "");
    setQueryValue(nextQuery, "gAllGames", followCurrentGame.value ? "" : "1");

    if (normalizeQuery(nextQuery) === normalizeQuery(route.query)) {
        return;
    }

    void router.replace({
        path: "/explore",
        query: nextQuery,
    });
}

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

function toTimestamp(value?: string) {
    if (!value) {
        return 0;
    }

    const timestamp = new Date(value).getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareGlossMods(
    left: IGlossExploreMod,
    right: IGlossExploreMod,
    sortKey: GlossSortKey,
) {
    switch (sortKey) {
        case "updatedAt":
            return (
                toTimestamp(right.mods_updateTime) -
                toTimestamp(left.mods_updateTime)
            );
        case "createdAt":
            return (
                toTimestamp(right.mods_createTime) -
                toTimestamp(left.mods_createTime)
            );
        case "downloads":
            return (
                toNumber(right.mods_download_cnt) -
                toNumber(left.mods_download_cnt)
            );
        case "views":
            return (
                toNumber(right.mods_click_cnt) - toNumber(left.mods_click_cnt)
            );
        case "favorites":
            return toNumber(right.mods_mark_cnt) - toNumber(left.mods_mark_cnt);
        default:
            return 0;
    }
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

function buildTranslationSourceItem(
    item: IGlossExploreMod,
): IExploreTranslationSourceItem {
    return {
        id: String(item.id),
        title: item.mods_title,
        summary: item.mods_desc ?? "",
        description: item.mods_content ?? "",
        typeName: item.mods_type_name,
        tags: getTags(item),
        resourceName: getLatestResource(item)?.mods_resource_name ?? "",
    };
}

type TranslationRefreshMode = "auto" | "manual";

function abortActiveTranslation() {
    translationAbortController?.abort();
    translationAbortController = null;
}

function cancelTranslations() {
    translationRequestSequence += 1;
    abortActiveTranslation();
    translationErrorMessage.value = "";
    translationLoading.value = false;
}

function clearTranslations() {
    cancelTranslations();
    translationMap.value = {};
    manualTranslationVisible.value = false;
}

async function refreshTranslations(mode: TranslationRefreshMode) {
    const currentRequestSequence = ++translationRequestSequence;

    if ((mode === "auto" && !props.autoTranslate) || mods.value.length === 0) {
        clearTranslations();
        return;
    }

    translationLoading.value = true;
    translationErrorMessage.value = "";
    abortActiveTranslation();
    const abortController = new AbortController();

    translationAbortController = abortController;

    try {
        const translatedMap = await translateExploreItems({
            baseUrl: props.aiBaseUrl,
            apiKey: props.aiApiKey,
            modelId: props.aiModelId,
            targetLocale: props.translationLocale,
            source: "GlossMod",
            items: mods.value.map(buildTranslationSourceItem),
            abortSignal: abortController.signal,
        });

        if (currentRequestSequence !== translationRequestSequence) {
            return;
        }

        translationMap.value = translatedMap;
        manualTranslationVisible.value = mode === "manual";
    } catch (error: unknown) {
        if (currentRequestSequence !== translationRequestSequence) {
            return;
        }

        if (abortController.signal.aborted) {
            translationErrorMessage.value = "";
            return;
        }

        translationMap.value = {};
        manualTranslationVisible.value = false;
        translationErrorMessage.value = getExploreTranslationErrorMessage(
            error,
            t("explore.translation.failed"),
        );
        console.error("Gloss Mods AI 翻译失败");
        console.error(error);
    } finally {
        if (currentRequestSequence === translationRequestSequence) {
            if (translationAbortController === abortController) {
                translationAbortController = null;
            }

            translationLoading.value = false;
        }
    }
}

function getTranslation(item: IGlossExploreMod) {
    return shouldShowTranslations.value
        ? translationMap.value[String(item.id)]
        : null;
}

function hasDifferentTranslation(original: string, translated?: string) {
    const normalizedOriginal = original.trim();
    const normalizedTranslated = translated?.trim() ?? "";

    return Boolean(
        normalizedTranslated && normalizedTranslated !== normalizedOriginal,
    );
}

function getTranslatedText(original: string, translated?: string) {
    if (!hasDifferentTranslation(original, translated)) {
        return original;
    }

    return translated?.trim() ?? original;
}

function getInlineTranslatedText(original: string, translated?: string) {
    const displayText = getTranslatedText(original, translated);

    if (!props.showOriginal || displayText === original) {
        return displayText;
    }

    return `${displayText} / ${original}`;
}

function getDisplayTitle(item: IGlossExploreMod) {
    return getTranslatedText(item.mods_title, getTranslation(item)?.title);
}

function shouldShowOriginalTitle(item: IGlossExploreMod) {
    return (
        props.showOriginal &&
        hasDifferentTranslation(item.mods_title, getTranslation(item)?.title)
    );
}

function getDisplayTypeName(item: IGlossExploreMod) {
    return getInlineTranslatedText(
        item.mods_type_name,
        getTranslation(item)?.typeName,
    );
}

function getDisplayTags(item: IGlossExploreMod): ITranslatedBadgeText[] {
    const translatedTags = getTranslation(item)?.tags ?? [];

    return getTags(item).map((tag, index) => ({
        key: tag,
        label: getInlineTranslatedText(tag, translatedTags[index]),
    }));
}

function resetFilters() {
    searchKeyword.value = "";
    tagKeyword.value = "";
    selectedOriginal.value = "all";
    selectedTime.value = "all";
    selectedType.value = "all";
    selectedSort.value = "default";
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
            query: {
                returnTo: route.fullPath,
            },
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

function jumpToPage() {
    const targetPage = Number(jumpPageInput.value);

    if (!Number.isFinite(targetPage)) {
        jumpPageInput.value = String(page.value);
        return;
    }

    goToPage(Math.round(targetPage));
}
</script>

<template>
    <div class="space-y-5">
        <section class="space-y-3">
            <div
                class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
            >
                <div class="relative w-full lg:max-w-md">
                    <IconSearch
                        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        v-model="searchKeyword"
                        class="h-10 pl-9"
                        :placeholder="t('explore.gloss.searchPlaceholder')"
                        @keydown.enter="fetchMods"
                    />
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        :variant="isFiltersExpanded ? 'secondary' : 'outline'"
                        @click="isFiltersExpanded = !isFiltersExpanded"
                    >
                        <IconListFilter class="size-4" />
                        {{
                            isFiltersExpanded
                                ? t("explore.actions.collapseFilters")
                                : t("explore.actions.expandFilters")
                        }}
                    </Button>
                    <Button
                        v-if="hasActiveFilters"
                        size="sm"
                        variant="ghost"
                        @click="resetFilters"
                    >
                        <IconFilterX class="size-4" />
                        {{ t("explore.actions.resetSearch") }}
                    </Button>
                </div>
            </div>

            <div
                class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
            >
                <span class="font-medium text-foreground">
                    {{
                        t("explore.common.totalResults", {
                            count: formatNumber(totalCount),
                        })
                    }}
                </span>
                <span aria-hidden="true">·</span>
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
                <template v-if="currentGameName">
                    <span aria-hidden="true">·</span>
                    <span>
                        {{
                            t("explore.common.currentGame", {
                                game: currentGameName,
                            })
                        }}
                    </span>
                </template>
                <template v-else>
                    <span aria-hidden="true">·</span>
                    <span>{{ t("explore.gloss.noLocalGameAllResults") }}</span>
                </template>
                <span
                    v-if="loading"
                    class="flex items-center gap-1.5 text-foreground"
                >
                    <IconLoaderCircle class="size-3 animate-spin" />
                    {{ t("explore.common.updating") }}
                </span>
                <span
                    v-if="translationLoading"
                    class="flex items-center gap-1.5 text-foreground"
                >
                    <IconLoaderCircle class="size-3 animate-spin" />
                    {{ t("explore.translation.translating") }}
                </span>
                <span v-else-if="translationErrorMessage" class="text-destructive">
                    {{ translationErrorMessage }}
                </span>
            </div>

            <div
                v-if="onlySupportGmm || onlyLocal || parsedTags.length"
                class="flex flex-wrap items-center gap-1.5"
            >
                <Badge v-if="onlySupportGmm" variant="secondary" class="rounded-full font-normal">
                    {{ t("explore.gloss.onlySupportGmm") }}
                </Badge>
                <Badge v-if="onlyLocal" variant="secondary" class="rounded-full font-normal">
                    {{ t("explore.gloss.onlyLocal") }}
                </Badge>
                <Badge
                    v-for="tag in parsedTags"
                    :key="tag"
                    variant="secondary"
                    class="rounded-full font-normal"
                >
                    {{ tag }}
                </Badge>
            </div>

            <div
                v-show="isFiltersExpanded"
                class="space-y-4 rounded-xl border bg-muted/25 p-4"
            >
                <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <div class="space-y-2">
                        <Label class="text-xs font-normal text-muted-foreground">
                            {{ t("explore.filters.tag") }}
                        </Label>
                        <Input
                            v-model="tagKeyword"
                            :placeholder="t('explore.filters.tagPlaceholder')"
                            @keydown.enter="fetchMods"
                        />
                    </div>

                    <div class="space-y-2">
                        <Label class="text-xs font-normal text-muted-foreground">
                            {{ t("explore.filters.sourceType") }}
                        </Label>
                        <Select v-model="selectedOriginal">
                            <SelectTrigger class="w-full">
                                <SelectValue
                                    :placeholder="t('explore.filters.allSources')"
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

                    <div class="space-y-2">
                        <Label class="text-xs font-normal text-muted-foreground">
                            {{ t("explore.filters.publishTime") }}
                        </Label>
                        <Select v-model="selectedTime">
                            <SelectTrigger class="w-full">
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

                    <div class="space-y-2">
                        <Label class="text-xs font-normal text-muted-foreground">
                            {{ t("explore.filters.gameType") }}
                        </Label>
                        <Select
                            v-model="selectedType"
                            :disabled="!currentTypeOptions.length"
                        >
                            <SelectTrigger class="w-full">
                                <SelectValue :placeholder="currentTypePlaceholder" />
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

                    <div class="space-y-2">
                        <Label class="text-xs font-normal text-muted-foreground">
                            {{ t("explore.filters.sort") }}
                        </Label>
                        <Select v-model="selectedSort">
                            <SelectTrigger class="w-full">
                                <SelectValue
                                    :placeholder="t('explore.filters.chooseSort')"
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="item in sortOptions"
                                    :key="item.value"
                                    :value="item.value"
                                >
                                    {{ item.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div class="space-y-2">
                        <Label class="text-xs font-normal text-muted-foreground">
                            {{ t("explore.filters.pageSize") }}
                        </Label>
                        <Select v-model="pageSize">
                            <SelectTrigger class="w-full">
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

                <Separator />

                <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div class="flex items-center gap-2">
                        <Switch id="onlySupportGmm" v-model="onlySupportGmm" />
                        <Label for="onlySupportGmm" class="text-sm font-normal">
                            {{ t("explore.gloss.onlySupportGmm") }}
                        </Label>
                    </div>
                    <div class="flex items-center gap-2">
                        <Switch id="onlyLocal" v-model="onlyLocal" />
                        <Label for="onlyLocal" class="text-sm font-normal">
                            {{ t("explore.gloss.onlyLocal") }}
                        </Label>
                    </div>
                </div>
            </div>
        </section>
        <section
            v-if="errorMessage"
            class="rounded-xl border border-destructive/30 bg-destructive/5 p-6"
        >
            <div
                class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
                <div class="flex items-start gap-3">
                    <IconCircleAlert class="mt-0.5 size-5 shrink-0 text-destructive" />
                    <div class="space-y-1">
                        <div class="text-sm font-medium">
                            {{ t("explore.common.loadFailed") }}
                        </div>
                        <p class="text-sm text-muted-foreground">
                            {{ errorMessage }}
                        </p>
                    </div>
                </div>
                <Button size="sm" variant="outline" @click="fetchMods">
                    <IconRefreshCcw class="size-4" />
                    {{ t("explore.actions.retry") }}
                </Button>
            </div>
        </section>

        <section
            v-else-if="loading && !mods.length"
            class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        >
            <div
                v-for="item in 8"
                :key="item"
                class="overflow-hidden rounded-xl border"
            >
                <div class="aspect-16/10 animate-pulse bg-muted"></div>
                <div class="space-y-3 p-4">
                    <div class="h-4 w-3/4 animate-pulse rounded bg-muted"></div>
                    <div class="h-3 w-1/2 animate-pulse rounded bg-muted"></div>
                    <div class="h-8 w-full animate-pulse rounded bg-muted"></div>
                </div>
            </div>
        </section>

        <section
            v-else-if="!mods.length"
            class="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center"
        >
            <div
                class="flex size-11 items-center justify-center rounded-full bg-muted"
            >
                <IconSearchX class="size-5 text-muted-foreground" />
            </div>
            <div class="mt-4 text-sm font-medium">
                {{ t("explore.empty.title") }}
            </div>
            <p class="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
                {{ t("explore.gloss.emptyDescription") }}
            </p>
            <Button size="sm" variant="outline" class="mt-5" @click="resetFilters">
                <IconFilterX class="size-4" />
                {{ t("explore.actions.clearFilters") }}
            </Button>
        </section>

        <template v-else>
            <section
                class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
                <article
                    v-for="item in sortedMods"
                    :key="item.id"
                    class="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
                >
                    <button
                        type="button"
                        class="relative block aspect-16/10 w-full cursor-pointer overflow-hidden bg-muted text-left"
                        @click="openModDetail(item)"
                    >
                        <img
                            :src="getCoverUrl(item)"
                            :data-fallback-src="getFallbackCoverUrl(item)"
                            :alt="getDisplayTitle(item)"
                            loading="lazy"
                            class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                            @error="handleCoverError"
                        />
                        <div
                            v-if="item.support_gmm || isCloudDriveMod(item)"
                            class="absolute top-2 left-2 flex flex-wrap gap-1.5"
                        >
                            <span
                                v-if="item.support_gmm"
                                class="rounded-md bg-emerald-500 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
                            >
                                {{ t("explore.gloss.supportGmm") }}
                            </span>
                            <span
                                v-if="isCloudDriveMod(item)"
                                class="rounded-md bg-sky-500 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
                            >
                                {{ t("explore.gloss.cloudDrive") }}
                            </span>
                        </div>
                    </button>

                    <div class="flex flex-1 flex-col gap-3 p-4">
                        <div class="space-y-1.5">
                            <h3
                                class="line-clamp-2 text-sm leading-5 font-medium"
                                :title="getDisplayTitle(item)"
                            >
                                {{ getDisplayTitle(item) }}
                            </h3>
                            <p
                                v-if="shouldShowOriginalTitle(item)"
                                class="line-clamp-1 text-xs text-muted-foreground"
                            >
                                {{ item.mods_title }}
                            </p>
                        </div>

                        <div
                            class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground"
                        >
                            <span class="truncate">
                                {{
                                    item.user_nickName ||
                                    item.mods_author ||
                                    t("explore.common.unknown")
                                }}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{{ formatDate(item.mods_updateTime) }}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                                {{
                                    getLatestResource(item)
                                        ?.mods_resource_size ||
                                    t("explore.common.unknownSize")
                                }}
                            </span>
                        </div>

                        <div
                            class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
                        >
                            <span class="flex items-center gap-1">
                                <IconDownload class="size-3.5" />
                                {{ formatNumber(item.mods_download_cnt) }}
                            </span>
                            <span class="flex items-center gap-1">
                                <IconEye class="size-3.5" />
                                {{ formatNumber(item.mods_click_cnt) }}
                            </span>
                            <span class="flex items-center gap-1">
                                <IconStar class="size-3.5" />
                                {{ formatNumber(item.mods_mark_cnt) }}
                            </span>
                        </div>

                        <div class="flex flex-wrap gap-1">
                            <Badge
                                variant="secondary"
                                class="rounded-md px-1.5 py-0 text-[11px] font-normal"
                            >
                                {{ getDisplayTypeName(item) }}
                            </Badge>
                            <Badge
                                variant="outline"
                                class="rounded-md px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
                            >
                                {{ getOriginalLabel(item.mods_original) }}
                            </Badge>
                            <Badge
                                v-for="tag in getDisplayTags(item).slice(0, 2)"
                                :key="tag.key"
                                variant="outline"
                                class="rounded-md px-1.5 py-0 text-[11px] font-normal text-muted-foreground"
                            >
                                {{ tag.label }}
                            </Badge>
                        </div>

                        <div class="mt-auto space-y-2 pt-1">
                            <div
                                v-if="shouldShowDownloadProgress(item)"
                                class="space-y-1"
                            >
                                <div
                                    class="h-1 overflow-hidden rounded-full bg-muted"
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
                                    <span>{{ getDownloadStatus(item).label }}</span>
                                    <span>{{ getDownloadStatus(item).progress }}%</span>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    @click="openModDetail(item)"
                                >
                                    {{ t("explore.actions.viewDetail") }}
                                </Button>
                                <Button
                                    size="sm"
                                    :class="getDownloadButtonClass(item)"
                                    :disabled="isDownloadActionDisabled(item)"
                                    @click="openLatestResource(item)"
                                >
                                    <IconDownload class="size-4" />
                                    {{ getDownloadButtonLabel(item) }}
                                </Button>
                            </div>
                        </div>
                    </div>
                </article>
            </section>

            <section
                class="flex flex-col items-center justify-between gap-4 border-t pt-5 lg:flex-row"
            >
                <p class="text-xs text-muted-foreground">
                    {{
                        t("explore.common.currentPageSummary", {
                            page,
                            totalPages,
                            totalCount: formatNumber(totalCount),
                        })
                    }}
                </p>

                <div class="flex flex-wrap items-center gap-1">
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        :disabled="page <= 1"
                        :aria-label="t('explore.actions.previousPage')"
                        @click="goToPage(page - 1)"
                    >
                        <IconChevronLeft class="size-4" />
                    </Button>

                    <template v-for="item in paginationItems" :key="item.key">
                        <span
                            v-if="item.ellipsis"
                            class="px-1 text-sm text-muted-foreground"
                        >
                            {{ item.label }}
                        </span>
                        <Button
                            v-else
                            size="icon-sm"
                            :variant="item.page === page ? 'default' : 'ghost'"
                            @click="goToPage(item.page ?? 1)"
                        >
                            {{ item.label }}
                        </Button>
                    </template>

                    <Button
                        size="icon-sm"
                        variant="ghost"
                        :disabled="page >= totalPages"
                        :aria-label="t('explore.actions.nextPage')"
                        @click="goToPage(page + 1)"
                    >
                        <IconChevronRight class="size-4" />
                    </Button>

                    <div class="ml-2 flex items-center gap-1.5">
                        <Input
                            v-model="jumpPageInput"
                            class="h-8 w-16"
                            type="number"
                            min="1"
                            :max="totalPages || 1"
                            @keydown.enter="jumpToPage"
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            :disabled="totalPages <= 1"
                            @click="jumpToPage"
                        >
                            {{ t("explore.actions.jumpPage") }}
                        </Button>
                    </div>
                </div>
            </section>
        </template>
    </div>
</template>

