<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    BadgeCheck,
    CircleDollarSign,
    ExternalLink,
    Gamepad2,
    HeartHandshake,
    LoaderCircle,
    QrCode,
    RefreshCcw,
    Search,
    ShieldCheck,
    Smartphone,
    Store,
} from "@lucide/vue";
import QrcodeVue from "qrcode.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableEmpty,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    formatCnyAmount,
    getPaymentChannelName,
    type CrowdfundingGame,
    type CrowdfundingGamesResponse,
    type CrowdfundingPaymentChannel,
    type CrowdfundingPaymentResponse,
    type CrowdfundingPaymentStatusResponse,
} from "@/lib/game-crowdfunding";
import {
    createBreadcrumbJsonLd,
    createWebPageJsonLd,
    useSeoMeta,
} from "@/lib/seo";
import { cn } from "@/lib/utils";

interface PendingCrowdfundingPaymentSession {
    discussionNumber: number;
    amount: number;
    payUser: string;
    channel: CrowdfundingPaymentChannel;
    outTradeNo: string;
    paymentOrderId: number;
    paymentOrderNo: string;
    payUrl: string;
    codeUrl: string;
    expiresAt: string;
    createdAt: string;
}

interface PollPaymentStatusOptions {
    stopWhenDialogClosed?: boolean;
}

type CrowdfundingStatusFilter =
    | "all"
    | "funding"
    | "completed"
    | "unknown-price";
type CrowdfundingSortKey =
    | "createdAt"
    | "gameName"
    | "targetAmount"
    | "raisedAmount"
    | "progress"
    | "remainingAmount"
    | "backerCount";
type SortDirection = "asc" | "desc";
type SortableValue = number | string | null;

const pageTitle = "游戏众筹";
const pageDescription =
    "汇总 GitHub Discussions 中标记为无游戏的新游戏请求，使用 Steam 商店价格生成众筹目标，并通过支付接口记录赞助进度。";

useSeoMeta({
    title: pageTitle,
    description: pageDescription,
    path: "/crowdfunding",
    keywords: ["游戏众筹", "赞助游戏", "Steam 游戏价格", "GMM 新游戏"],
    structuredData: [
        createWebPageJsonLd(pageTitle, pageDescription, "/crowdfunding"),
        createBreadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: "游戏众筹", path: "/crowdfunding" },
        ]),
    ],
});

const {
    data: crowdfundingData,
    pending: isLoading,
    error: loadError,
    refresh,
} = await useFetch<CrowdfundingGamesResponse>("/api/crowdfunding/games");

const selectedGame = ref<CrowdfundingGame | null>(null);
const isPaymentDialogOpen = ref(false);
const sponsorAmount = ref("10.00");
const payUser = ref("");
const paymentChannel = ref<CrowdfundingPaymentChannel>("alipay");
const activePayment = ref<CrowdfundingPaymentResponse | null>(null);
const paymentError = ref("");
const paymentSuccess = ref("");
const paymentSuccessNotice = ref("");
const isCreatingPayment = ref(false);
const isCheckingPayment = ref(false);
const isMobileDevice = ref(false);
const gameSearchQuery = ref("");
const gameStatusFilter = ref<CrowdfundingStatusFilter>("all");
const gameSortKey = ref<CrowdfundingSortKey>("createdAt");
const gameSortDirection = ref<SortDirection>("desc");

const statusFilterOptions: Array<{
    value: CrowdfundingStatusFilter;
    label: string;
}> = [
    { value: "all", label: "全部状态" },
    { value: "funding", label: "众筹中" },
    { value: "completed", label: "已完成" },
    { value: "unknown-price", label: "价格待确认" },
];
const sortOptions: Array<{ value: CrowdfundingSortKey; label: string }> = [
    { value: "createdAt", label: "创建时间" },
    { value: "gameName", label: "游戏名称" },
    { value: "targetAmount", label: "目标金额" },
    { value: "raisedAmount", label: "已筹金额" },
    { value: "progress", label: "进度" },
    { value: "remainingAmount", label: "剩余金额" },
    { value: "backerCount", label: "参与人数" },
];
const games = computed(() => crowdfundingData.value?.games || []);
const isGameCompleted = (game: CrowdfundingGame) =>
    game.funding.targetAmount !== null &&
    game.funding.raisedAmount >= game.funding.targetAmount;
const getGameStatus = (game: CrowdfundingGame): CrowdfundingStatusFilter => {
    if (game.funding.targetAmount === null) {
        return "unknown-price";
    }

    return isGameCompleted(game) ? "completed" : "funding";
};
const getGameStatusLabel = (game: CrowdfundingGame) => {
    const status = getGameStatus(game);

    return (
        statusFilterOptions.find((option) => option.value === status)?.label ||
        "众筹中"
    );
};
const getGameStatusVariant = (
    game: CrowdfundingGame,
): "default" | "secondary" | "outline" => {
    if (getGameStatus(game) === "completed") {
        return "default";
    }

    return getGameStatus(game) === "unknown-price" ? "outline" : "secondary";
};
const getGameSearchText = (game: CrowdfundingGame) =>
    [
        game.gameName,
        game.discussion.title,
        game.discussion.body,
        `#${game.discussion.number}`,
        String(game.discussion.number),
        game.steam?.name,
        game.steam?.shortDescription,
        game.additionalInfo,
        game.sourceUrl,
        game.modUrl,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
const getGameSortValue = (
    game: CrowdfundingGame,
    key: CrowdfundingSortKey,
): SortableValue => {
    switch (key) {
        case "createdAt":
            return new Date(game.discussion.createdAt).getTime();
        case "gameName":
            return game.gameName.toLowerCase();
        case "targetAmount":
            return game.funding.targetAmount;
        case "raisedAmount":
            return game.funding.raisedAmount;
        case "progress":
            return game.funding.progress;
        case "remainingAmount":
            return game.funding.remainingAmount;
        case "backerCount":
            return game.funding.backerCount;
        default:
            return null;
    }
};
const compareSortableValues = (
    left: SortableValue,
    right: SortableValue,
    direction: SortDirection,
) => {
    if (left === null && right === null) {
        return 0;
    }

    if (left === null) {
        return 1;
    }

    if (right === null) {
        return -1;
    }

    const result =
        typeof left === "string" && typeof right === "string"
            ? left.localeCompare(right, "zh-CN")
            : Number(left) - Number(right);

    return direction === "asc" ? result : -result;
};
const filteredGames = computed(() => {
    const searchText = gameSearchQuery.value.trim().toLowerCase();

    return games.value
        .filter((game) => {
            const status = getGameStatus(game);
            const matchesStatus =
                gameStatusFilter.value === "all" ||
                status === gameStatusFilter.value;
            const matchesSearch =
                !searchText || getGameSearchText(game).includes(searchText);

            return matchesStatus && matchesSearch;
        })
        .slice()
        .sort((leftGame, rightGame) => {
            const sortResult = compareSortableValues(
                getGameSortValue(leftGame, gameSortKey.value),
                getGameSortValue(rightGame, gameSortKey.value),
                gameSortDirection.value,
            );

            if (sortResult !== 0) {
                return sortResult;
            }

            return rightGame.discussion.number - leftGame.discussion.number;
        });
});
const hasActiveGameFilters = computed(
    () =>
        gameSearchQuery.value.trim().length > 0 ||
        gameStatusFilter.value !== "all",
);
const setGameSort = (key: CrowdfundingSortKey) => {
    if (gameSortKey.value === key) {
        gameSortDirection.value =
            gameSortDirection.value === "asc" ? "desc" : "asc";
        return;
    }

    gameSortKey.value = key;
    gameSortDirection.value = key === "gameName" ? "asc" : "desc";
};
const toggleSortDirection = () => {
    gameSortDirection.value =
        gameSortDirection.value === "asc" ? "desc" : "asc";
};
const getSortIcon = (key: CrowdfundingSortKey) => {
    if (gameSortKey.value !== key) {
        return ArrowUpDown;
    }

    return gameSortDirection.value === "asc" ? ArrowUp : ArrowDown;
};
const sortDirectionLabel = computed(() =>
    gameSortDirection.value === "asc" ? "升序" : "降序",
);
const resetGameFilters = () => {
    gameSearchQuery.value = "";
    gameStatusFilter.value = "all";
};
const pendingPaymentStorageKey = "gmm:crowdfunding:pending-payment";
const pendingPaymentMaxAge = 1000 * 60 * 30;
const totalTargetAmount = computed(() =>
    games.value.reduce(
        (total, game) => total + (game.funding.targetAmount || 0),
        0,
    ),
);
const totalRaisedAmount = computed(() =>
    games.value.reduce((total, game) => total + game.funding.raisedAmount, 0),
);
const fundedGamesCount = computed(
    () =>
        games.value.filter(
            (game) =>
                game.funding.targetAmount !== null &&
                game.funding.raisedAmount >= game.funding.targetAmount,
        ).length,
);
const selectedAmount = computed(() => Number(sponsorAmount.value));
const amountError = computed(() => {
    if (!Number.isFinite(selectedAmount.value)) {
        return "请输入有效金额。";
    }

    if (selectedAmount.value < 1 || selectedAmount.value > 9999) {
        return "赞助金额需在 1 到 9999 元之间。";
    }

    return "";
});
const createPaymentButtonText = computed(() => {
    if (isCreatingPayment.value || isCheckingPayment.value) {
        return "处理中";
    }

    return `使用${getPaymentChannelName(paymentChannel.value)}赞助`;
});
const activePaymentValue = computed(() => {
    if (!activePayment.value) {
        return "";
    }

    return activePayment.value.payment.channel === "wechat"
        ? activePayment.value.payment.codeUrl ||
              activePayment.value.payment.payUrl
        : activePayment.value.payment.payUrl ||
              activePayment.value.payment.codeUrl;
});
const activePaymentChannelName = computed(() =>
    activePayment.value
        ? getPaymentChannelName(activePayment.value.payment.channel)
        : "",
);
const activePaymentChannelClass = computed(() =>
    cn(
        "relative flex items-center justify-center rounded-lg border-2 p-3 text-base font-semibold",
        activePayment.value?.payment.channel === "wechat"
            ? "border-primary bg-primary/5 text-primary"
            : "border-primary bg-primary/5 text-primary",
    ),
);
const shouldShowAlipayFrame = computed(
    () =>
        activePayment.value?.payment.channel === "alipay" &&
        Boolean(activePaymentValue.value),
);
const shouldShowWechatQrCode = computed(
    () =>
        activePayment.value?.payment.channel === "wechat" &&
        Boolean(activePaymentValue.value),
);
const paymentHelperText = computed(() => {
    if (isCheckingPayment.value) {
        return "等待扫码支付...";
    }

    if (activePayment.value?.payment.channel === "wechat") {
        return "请使用微信扫码完成支付";
    }

    return "打开支付宝扫一扫";
});
const paymentQrCaption = computed(() =>
    activePayment.value?.payment.channel === "alipay"
        ? "支付二维码会在弹窗内展示，扫码后请留在本页等待确认。"
        : "请使用微信扫码完成支付，完成后本页会自动确认。",
);
const paymentSecurityText = computed(() =>
    activePayment.value?.payment.channel === "wechat"
        ? "微信支付官方通道承载"
        : "支付宝官方安全支付中心承载",
);

const formatDate = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
    }).format(new Date(value));

const formatAmountInput = (amount: number) =>
    Math.min(Math.max(amount, 1), 9999).toFixed(2);

const getDefaultSponsorAmount = (game: CrowdfundingGame) => {
    if (isGameCompleted(game)) {
        return 10;
    }

    if (
        typeof game.funding.remainingAmount === "number" &&
        game.funding.remainingAmount > 0
    ) {
        return game.funding.remainingAmount;
    }

    if (typeof game.steam?.price?.finalAmount === "number") {
        return Math.max(game.steam.price.finalAmount, 1);
    }

    return 10;
};

const replaceGame = (nextGame: CrowdfundingGame) => {
    if (!crowdfundingData.value) {
        return;
    }

    crowdfundingData.value = {
        ...crowdfundingData.value,
        games: crowdfundingData.value.games.map((game) =>
            game.discussion.number === nextGame.discussion.number
                ? nextGame
                : game,
        ),
        generatedAt: new Date().toISOString(),
    };

    if (selectedGame.value?.discussion.number === nextGame.discussion.number) {
        selectedGame.value = nextGame;
    }
};

const openPaymentDialog = (game: CrowdfundingGame) => {
    selectedGame.value = game;
    sponsorAmount.value = formatAmountInput(getDefaultSponsorAmount(game));
    activePayment.value = null;
    paymentError.value = "";
    paymentSuccess.value = "";
    isPaymentDialogOpen.value = true;
};

const setPaymentChannel = (value: unknown) => {
    if (value === "alipay" || value === "wechat") {
        paymentChannel.value = value;
    }
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let paymentSuccessNoticeTimer: number | null = null;

const syncDeviceState = () => {
    if (typeof window === "undefined") {
        return;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    isMobileDevice.value =
        /android|iphone|ipad|ipod|iemobile|opera mini|mobile/i.test(
            userAgent,
        ) || window.innerWidth < 768;
};

const persistPendingPayment = (session: PendingCrowdfundingPaymentSession) => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(
        pendingPaymentStorageKey,
        JSON.stringify(session),
    );
};

const getPendingPayment = (): PendingCrowdfundingPaymentSession | null => {
    if (typeof window === "undefined") {
        return null;
    }

    const rawValue = window.localStorage.getItem(pendingPaymentStorageKey);

    if (!rawValue) {
        return null;
    }

    try {
        const session = JSON.parse(
            rawValue,
        ) as PendingCrowdfundingPaymentSession;

        // Sessions stored before the payment center migration carry no usable
        // order id, so the status query could never resolve them.
        if (!Number.isInteger(session?.paymentOrderId)) {
            window.localStorage.removeItem(pendingPaymentStorageKey);
            return null;
        }

        return session;
    } catch {
        window.localStorage.removeItem(pendingPaymentStorageKey);
        return null;
    }
};

const clearPendingPayment = () => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.removeItem(pendingPaymentStorageKey);
};

const getActivePaymentSession =
    (): PendingCrowdfundingPaymentSession | null => {
        if (!activePayment.value) {
            return null;
        }

        return {
            discussionNumber: activePayment.value.game.discussion.number,
            amount: activePayment.value.record.amount,
            payUser: activePayment.value.record.payUser,
            channel: activePayment.value.payment.channel,
            outTradeNo: activePayment.value.payment.outTradeNo,
            paymentOrderId: activePayment.value.payment.paymentOrderId,
            paymentOrderNo: activePayment.value.payment.paymentOrderNo,
            payUrl: activePayment.value.payment.payUrl,
            codeUrl: activePayment.value.payment.codeUrl,
            expiresAt: activePayment.value.payment.expiresAt,
            createdAt: activePayment.value.record.createdAt,
        };
    };

const applyPaymentStatusResponse = (
    session: PendingCrowdfundingPaymentSession,
    response: CrowdfundingPaymentStatusResponse,
) => {
    activePayment.value = {
        game: response.game,
        payment: {
            channel: session.channel,
            outTradeNo: session.outTradeNo,
            paymentOrderId: session.paymentOrderId,
            paymentOrderNo: session.paymentOrderNo,
            payUrl: session.payUrl,
            codeUrl: session.codeUrl,
            expiresAt: session.expiresAt,
        },
        record: response.record,
    };
    replaceGame(response.game);
};

const requestPaymentStatus = async (
    session: PendingCrowdfundingPaymentSession,
) =>
    $fetch<CrowdfundingPaymentStatusResponse>("/api/crowdfunding/pay/status", {
        method: "POST",
        body: {
            discussionNumber: session.discussionNumber,
            outTradeNo: session.outTradeNo,
            paymentOrderId: session.paymentOrderId,
            channel: session.channel,
            amount: session.amount,
            payUser: session.payUser,
        },
    });

const showPaymentSuccessNotice = () => {
    paymentSuccessNotice.value = "支付成功，感谢您的参与";

    if (typeof window === "undefined") {
        return;
    }

    if (paymentSuccessNoticeTimer) {
        window.clearTimeout(paymentSuccessNoticeTimer);
    }

    paymentSuccessNoticeTimer = window.setTimeout(() => {
        paymentSuccessNotice.value = "";
        paymentSuccessNoticeTimer = null;
    }, 6000);
};

const completeSuccessfulPayment = async () => {
    clearPendingPayment();
    paymentSuccess.value = "支付成功，感谢您的参与";
    isPaymentDialogOpen.value = false;
    showPaymentSuccessNotice();
    await refresh();
};

const pollPaymentStatus = async (
    session: PendingCrowdfundingPaymentSession,
    options: PollPaymentStatusOptions = {},
) => {
    isCheckingPayment.value = true;
    const shouldStopWhenDialogClosed =
        options.stopWhenDialogClosed ?? !isMobileDevice.value;

    try {
        for (let index = 0; index < 40; index += 1) {
            if (
                shouldStopWhenDialogClosed &&
                !isPaymentDialogOpen.value &&
                index > 0
            ) {
                break;
            }

            const response = await requestPaymentStatus(session);
            applyPaymentStatusResponse(session, response);

            if (response.isPaid) {
                await completeSuccessfulPayment();
                return;
            }

            if (
                response.record.status === "closed" ||
                response.record.status === "failed"
            ) {
                clearPendingPayment();
                paymentError.value =
                    response.record.status === "failed"
                        ? "支付失败，请重新发起支付。"
                        : "订单已关闭，请重新发起支付。";
                return;
            }

            await wait(3000);
        }

        if (isPaymentDialogOpen.value || !shouldStopWhenDialogClosed) {
            paymentError.value = "暂未检测到支付成功，可稍后刷新状态。";
        }
    } finally {
        isCheckingPayment.value = false;
    }
};

const syncPendingPaymentStatus = async () => {
    const pendingPayment = getPendingPayment();

    if (!pendingPayment) {
        return;
    }

    const createdAt = new Date(pendingPayment.createdAt).getTime();

    if (
        !Number.isFinite(createdAt) ||
        Date.now() - createdAt > pendingPaymentMaxAge
    ) {
        clearPendingPayment();
        return;
    }

    try {
        const response = await requestPaymentStatus(pendingPayment);

        if (response.isPaid) {
            applyPaymentStatusResponse(pendingPayment, response);
            clearPendingPayment();
            await refresh();
            return;
        }

        if (
            response.record.status === "closed" ||
            response.record.status === "failed"
        ) {
            clearPendingPayment();
        }
    } catch {
        // Keep page entry quiet. The next manual payment/status check can retry.
    }
};

const createPayment = async () => {
    if (!selectedGame.value || amountError.value) {
        return;
    }

    paymentError.value = "";
    paymentSuccess.value = "";
    isCreatingPayment.value = true;

    try {
        const response = await $fetch<CrowdfundingPaymentResponse>(
            "/api/crowdfunding/pay",
            {
                method: "POST",
                body: {
                    discussionNumber: selectedGame.value.discussion.number,
                    amount: selectedAmount.value,
                    channel: paymentChannel.value,
                    payUser: payUser.value,
                },
            },
        );
        const session: PendingCrowdfundingPaymentSession = {
            discussionNumber: response.game.discussion.number,
            amount: response.record.amount,
            payUser: response.record.payUser,
            channel: response.payment.channel,
            outTradeNo: response.payment.outTradeNo,
            paymentOrderId: response.payment.paymentOrderId,
            paymentOrderNo: response.payment.paymentOrderNo,
            payUrl: response.payment.payUrl,
            codeUrl: response.payment.codeUrl,
            expiresAt: response.payment.expiresAt,
            createdAt: response.record.createdAt,
        };
        const paymentUrl = response.payment.payUrl || response.payment.codeUrl;

        if (!paymentUrl) {
            throw new Error("支付链接生成失败，请稍后重试。");
        }

        activePayment.value = response;
        persistPendingPayment(session);

        await pollPaymentStatus(session, {
            stopWhenDialogClosed: true,
        });
    } catch (error) {
        paymentError.value =
            error instanceof Error ? error.message : "创建支付单失败。";
    } finally {
        isCreatingPayment.value = false;
    }
};

const refreshPaymentStatus = async () => {
    const session = getActivePaymentSession();

    if (!session) {
        return;
    }

    paymentError.value = "";
    isCheckingPayment.value = true;

    try {
        const response = await requestPaymentStatus(session);

        applyPaymentStatusResponse(session, response);

        if (response.isPaid) {
            await completeSuccessfulPayment();
        }
    } catch (error) {
        paymentError.value =
            error instanceof Error ? error.message : "刷新支付状态失败。";
    } finally {
        isCheckingPayment.value = false;
    }
};

watch(isPaymentDialogOpen, (isOpen) => {
    if (!isOpen) {
        clearPendingPayment();
        activePayment.value = null;
        paymentError.value = "";
        paymentSuccess.value = "";
    }
});

onMounted(async () => {
    syncDeviceState();
    window.addEventListener("resize", syncDeviceState);
    await syncPendingPaymentStatus();
});

onBeforeUnmount(() => {
    if (typeof window === "undefined") {
        return;
    }

    if (paymentSuccessNoticeTimer) {
        window.clearTimeout(paymentSuccessNoticeTimer);
    }

    window.removeEventListener("resize", syncDeviceState);
});
</script>

<template>
    <div
        class="container mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 md:px-8 md:py-16"
    >
        <section
            class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
        >
            <div class="flex max-w-3xl flex-col gap-4">
                <Badge variant="outline" class="w-fit">
                    GitHub Discussions
                </Badge>
                <div class="flex flex-col gap-3">
                    <h1 class="text-3xl font-bold tracking-tight md:text-5xl">
                        赞助游戏
                    </h1>
                    <p class="text-sm leading-7 text-muted-foreground">
                        下面这些是我未拥有的游戏，您可以通过赞助这些游戏来支持我为其制作Mod安装适配
                    </p>
                </div>
            </div>

            <div
                class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-lg"
            >
                <div class="rounded-lg border bg-card p-4">
                    <div class="text-muted-foreground">待众筹</div>
                    <div class="mt-1 text-2xl font-semibold">
                        {{ games.length }}
                    </div>
                </div>
                <div class="rounded-lg border bg-card p-4">
                    <div class="text-muted-foreground">已完成</div>
                    <div class="mt-1 text-2xl font-semibold">
                        {{ fundedGamesCount }}
                    </div>
                </div>
                <div class="rounded-lg border bg-card p-4">
                    <div class="text-muted-foreground">目标</div>
                    <div class="mt-1 text-lg font-semibold">
                        {{ formatCnyAmount(totalTargetAmount) }}
                    </div>
                </div>
                <div class="rounded-lg border bg-card p-4">
                    <div class="text-muted-foreground">已赞助</div>
                    <div class="mt-1 text-lg font-semibold">
                        {{ formatCnyAmount(totalRaisedAmount) }}
                    </div>
                </div>
            </div>
        </section>

        <Alert v-if="loadError" variant="destructive">
            <AlertCircle />
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>
                {{ loadError.message || "无法读取 GitHub Discussions。" }}
            </AlertDescription>
        </Alert>

        <Alert v-if="paymentSuccessNotice">
            <BadgeCheck />
            <AlertTitle>{{ paymentSuccessNotice }}</AlertTitle>
        </Alert>

        <div v-if="isLoading" class="flex flex-col gap-3">
            <div class="flex flex-col gap-3 lg:hidden">
                <div
                    v-for="index in 4"
                    :key="index"
                    class="flex flex-col gap-3 rounded-lg border bg-card p-3"
                >
                    <div class="flex items-center gap-3">
                        <Skeleton class="size-16 shrink-0 rounded-md" />
                        <div class="flex min-w-0 flex-1 flex-col gap-2">
                            <Skeleton class="h-5 w-3/4" />
                            <Skeleton class="h-4 w-full" />
                            <Skeleton class="h-4 w-1/2" />
                        </div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <Skeleton class="h-4 w-24" />
                        <Skeleton class="h-2 w-full" />
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <Skeleton class="h-10" />
                        <Skeleton class="h-10" />
                        <Skeleton class="h-10" />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <Skeleton class="h-9" />
                        <Skeleton class="h-9" />
                    </div>
                </div>
            </div>

            <div class="hidden rounded-lg border bg-card lg:block">
                <Table class="min-w-270">
                    <TableHeader>
                        <TableRow>
                            <TableHead class="w-90">游戏</TableHead>
                            <TableHead>价格/目标</TableHead>
                            <TableHead>已筹</TableHead>
                            <TableHead class="w-45">进度</TableHead>
                            <TableHead>剩余</TableHead>
                            <TableHead>参与</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead class="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="index in 6" :key="index">
                            <TableCell class="whitespace-normal">
                                <div class="flex items-center gap-3">
                                    <Skeleton class="size-14 rounded-md" />
                                    <div
                                        class="flex min-w-0 flex-1 flex-col gap-2"
                                    >
                                        <Skeleton class="h-5 w-48" />
                                        <Skeleton class="h-4 w-64" />
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Skeleton class="h-5 w-20" />
                            </TableCell>
                            <TableCell>
                                <Skeleton class="h-5 w-20" />
                            </TableCell>
                            <TableCell>
                                <div class="flex w-36 flex-col gap-2">
                                    <Skeleton class="h-4 w-16" />
                                    <Skeleton class="h-2 w-full" />
                                </div>
                            </TableCell>
                            <TableCell>
                                <Skeleton class="h-5 w-20" />
                            </TableCell>
                            <TableCell>
                                <Skeleton class="h-5 w-10" />
                            </TableCell>
                            <TableCell>
                                <Skeleton class="h-5 w-16" />
                            </TableCell>
                            <TableCell class="text-right">
                                <Skeleton class="ml-auto h-8 w-28" />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>

        <section v-else-if="games.length" class="flex flex-col gap-4">
            <div
                class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
            >
                <div class="flex flex-1 flex-col gap-3 sm:flex-row">
                    <div class="relative flex-1">
                        <Search
                            class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            v-model="gameSearchQuery"
                            type="search"
                            placeholder="搜索游戏、Discussion 或简介"
                            aria-label="搜索众筹游戏"
                            class="pl-9"
                        />
                    </div>
                    <Select v-model="gameStatusFilter">
                        <SelectTrigger
                            class="w-full sm:w-45"
                            aria-label="按众筹状态筛选"
                        >
                            <SelectValue placeholder="全部状态" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem
                                    v-for="option in statusFilterOptions"
                                    :key="option.value"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>

                <div
                    class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:items-center"
                >
                    <Select v-model="gameSortKey">
                        <SelectTrigger
                            class="w-full sm:w-45"
                            aria-label="选择排序字段"
                        >
                            <SelectValue placeholder="排序字段" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem
                                    v-for="option in sortOptions"
                                    :key="option.value"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    <Button
                        type="button"
                        variant="outline"
                        class="justify-center px-3 sm:w-24"
                        @click="toggleSortDirection"
                    >
                        <ArrowUp
                            v-if="gameSortDirection === 'asc'"
                            data-icon="inline-start"
                        />
                        <ArrowDown v-else data-icon="inline-start" />
                        {{ sortDirectionLabel }}
                    </Button>
                </div>
            </div>

            <div
                class="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
            >
                <div>显示 {{ filteredGames.length }} / {{ games.length }}</div>
                <Button
                    v-if="hasActiveGameFilters"
                    type="button"
                    variant="ghost"
                    size="sm"
                    @click="resetGameFilters"
                >
                    重置筛选
                </Button>
            </div>

            <div class="flex flex-col gap-3 lg:hidden">
                <Empty
                    v-if="!filteredGames.length"
                    class="rounded-lg border bg-card"
                >
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Search />
                        </EmptyMedia>
                        <EmptyTitle>没有匹配的游戏</EmptyTitle>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button
                            v-if="hasActiveGameFilters"
                            type="button"
                            variant="outline"
                            size="sm"
                            @click="resetGameFilters"
                        >
                            重置筛选
                        </Button>
                    </EmptyContent>
                </Empty>

                <template v-else>
                    <article
                        v-for="game in filteredGames"
                        :key="game.discussion.number"
                        class="flex flex-col gap-3 rounded-lg border bg-card p-3"
                    >
                        <div class="flex gap-3">
                            <div
                                class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground"
                            >
                                <img
                                    v-if="game.steam?.headerImage"
                                    :src="game.steam.headerImage"
                                    :alt="`${game.gameName} Steam 封面`"
                                    loading="lazy"
                                    decoding="async"
                                    referrerpolicy="no-referrer"
                                    class="size-full object-cover"
                                />
                                <Gamepad2 v-else />
                            </div>
                            <div class="flex min-w-0 flex-1 flex-col gap-2">
                                <div
                                    class="flex items-start justify-between gap-2"
                                >
                                    <div class="min-w-0">
                                        <h2
                                            class="truncate text-base font-semibold"
                                        >
                                            {{ game.gameName }}
                                        </h2>
                                        <p
                                            class="line-clamp-2 text-xs text-muted-foreground"
                                        >
                                            {{
                                                game.steam?.shortDescription ||
                                                game.additionalInfo ||
                                                "这个请求还在等待游戏本体。"
                                            }}
                                        </p>
                                    </div>
                                    <Badge
                                        :variant="getGameStatusVariant(game)"
                                        class="shrink-0"
                                    >
                                        {{ getGameStatusLabel(game) }}
                                    </Badge>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                        #{{ game.discussion.number }}
                                    </Badge>
                                    <Badge variant="outline">
                                        {{
                                            game.steam?.price?.finalFormatted ||
                                            "价格待确认"
                                        }}
                                    </Badge>
                                    <span class="text-xs text-muted-foreground">
                                        {{
                                            formatDate(
                                                game.discussion.createdAt,
                                            )
                                        }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div class="flex flex-col gap-2">
                            <div
                                class="flex items-center justify-between gap-3 text-sm"
                            >
                                <span class="text-muted-foreground">
                                    众筹进度
                                </span>
                                <span class="font-medium">
                                    {{
                                        game.funding.targetAmount === null
                                            ? "待确认"
                                            : `${game.funding.progress}%`
                                    }}
                                </span>
                            </div>
                            <Progress :model-value="game.funding.progress" />
                        </div>

                        <div class="grid grid-cols-3 gap-3 text-xs">
                            <div class="flex min-w-0 flex-col gap-1">
                                <span class="text-muted-foreground">目标</span>
                                <span class="truncate font-medium">
                                    {{
                                        formatCnyAmount(
                                            game.funding.targetAmount,
                                        )
                                    }}
                                </span>
                            </div>
                            <div class="flex min-w-0 flex-col gap-1">
                                <span class="text-muted-foreground">已筹</span>
                                <span class="truncate font-medium">
                                    {{
                                        formatCnyAmount(
                                            game.funding.raisedAmount,
                                        )
                                    }}
                                </span>
                            </div>
                            <div class="flex min-w-0 flex-col gap-1">
                                <span class="text-muted-foreground">参与</span>
                                <span class="truncate font-medium">
                                    {{ game.funding.backerCount }}
                                </span>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                size="sm"
                                class="w-full"
                                @click="openPaymentDialog(game)"
                            >
                                <HeartHandshake data-icon="inline-start" />
                                赞助
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                class="w-full"
                                as-child
                            >
                                <a
                                    :href="game.discussion.url"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    讨论
                                    <ExternalLink data-icon="inline-end" />
                                </a>
                            </Button>
                        </div>
                    </article>
                </template>
            </div>

            <div class="hidden rounded-lg border bg-card lg:block">
                <Table class="min-w-270">
                    <TableHeader>
                        <TableRow>
                            <TableHead class="w-90">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="-ml-3"
                                    @click="setGameSort('gameName')"
                                >
                                    游戏
                                    <component
                                        :is="getSortIcon('gameName')"
                                        data-icon="inline-end"
                                    />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="-ml-3"
                                    @click="setGameSort('targetAmount')"
                                >
                                    价格/目标
                                    <component
                                        :is="getSortIcon('targetAmount')"
                                        data-icon="inline-end"
                                    />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="-ml-3"
                                    @click="setGameSort('raisedAmount')"
                                >
                                    已筹
                                    <component
                                        :is="getSortIcon('raisedAmount')"
                                        data-icon="inline-end"
                                    />
                                </Button>
                            </TableHead>
                            <TableHead class="w-45">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="-ml-3"
                                    @click="setGameSort('progress')"
                                >
                                    进度
                                    <component
                                        :is="getSortIcon('progress')"
                                        data-icon="inline-end"
                                    />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="-ml-3"
                                    @click="setGameSort('remainingAmount')"
                                >
                                    剩余
                                    <component
                                        :is="getSortIcon('remainingAmount')"
                                        data-icon="inline-end"
                                    />
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    class="-ml-3"
                                    @click="setGameSort('backerCount')"
                                >
                                    参与
                                    <component
                                        :is="getSortIcon('backerCount')"
                                        data-icon="inline-end"
                                    />
                                </Button>
                            </TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead class="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableEmpty v-if="!filteredGames.length" :colspan="8">
                            <div class="flex flex-col items-center gap-3">
                                <div class="font-medium">没有匹配的游戏</div>
                                <Button
                                    v-if="hasActiveGameFilters"
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    @click="resetGameFilters"
                                >
                                    重置筛选
                                </Button>
                            </div>
                        </TableEmpty>
                        <template v-else>
                            <TableRow
                                v-for="game in filteredGames"
                                :key="game.discussion.number"
                            >
                                <TableCell class="min-w-90 whitespace-normal">
                                    <div class="flex items-center gap-3">
                                        <div
                                            class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground"
                                        >
                                            <img
                                                v-if="game.steam?.headerImage"
                                                :src="game.steam.headerImage"
                                                :alt="`${game.gameName} Steam 封面`"
                                                loading="lazy"
                                                decoding="async"
                                                referrerpolicy="no-referrer"
                                                class="size-full object-cover"
                                            />
                                            <Gamepad2 v-else />
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <div class="truncate font-medium">
                                                {{ game.gameName }}
                                            </div>
                                            <div
                                                class="line-clamp-1 text-xs text-muted-foreground"
                                            >
                                                {{
                                                    game.steam
                                                        ?.shortDescription ||
                                                    game.additionalInfo ||
                                                    "这个请求还在等待游戏本体。"
                                                }}
                                            </div>
                                            <div
                                                class="mt-1 flex flex-wrap items-center gap-2"
                                            >
                                                <Badge variant="secondary">
                                                    #{{
                                                        game.discussion.number
                                                    }}
                                                </Badge>
                                                <span
                                                    class="text-xs text-muted-foreground"
                                                >
                                                    {{
                                                        formatDate(
                                                            game.discussion
                                                                .createdAt,
                                                        )
                                                    }}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div class="flex flex-col gap-1">
                                        <span class="font-medium">
                                            {{
                                                game.steam?.price
                                                    ?.finalFormatted ||
                                                "价格待确认"
                                            }}
                                        </span>
                                        <span
                                            class="text-xs text-muted-foreground"
                                        >
                                            目标
                                            {{
                                                formatCnyAmount(
                                                    game.funding.targetAmount,
                                                )
                                            }}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell class="font-medium">
                                    {{
                                        formatCnyAmount(
                                            game.funding.raisedAmount,
                                        )
                                    }}
                                </TableCell>
                                <TableCell>
                                    <div class="flex w-40 flex-col gap-2">
                                        <div
                                            class="flex items-center justify-between gap-3 text-xs"
                                        >
                                            <span class="text-muted-foreground">
                                                众筹进度
                                            </span>
                                            <span class="font-medium">
                                                {{
                                                    game.funding
                                                        .targetAmount === null
                                                        ? "待确认"
                                                        : `${game.funding.progress}%`
                                                }}
                                            </span>
                                        </div>
                                        <Progress
                                            :model-value="game.funding.progress"
                                        />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {{
                                        formatCnyAmount(
                                            game.funding.remainingAmount,
                                        )
                                    }}
                                </TableCell>
                                <TableCell>
                                    {{ game.funding.backerCount }}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        :variant="getGameStatusVariant(game)"
                                    >
                                        {{ getGameStatusLabel(game) }}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div
                                        class="flex items-center justify-end gap-2"
                                    >
                                        <Button
                                            type="button"
                                            size="sm"
                                            @click="openPaymentDialog(game)"
                                        >
                                            <HeartHandshake
                                                data-icon="inline-start"
                                            />
                                            赞助
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            as-child
                                        >
                                            <a
                                                :href="game.discussion.url"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                讨论
                                                <ExternalLink
                                                    data-icon="inline-end"
                                                />
                                            </a>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        </template>
                    </TableBody>
                </Table>
            </div>
        </section>

        <Empty v-else>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <BadgeCheck />
                </EmptyMedia>
                <EmptyTitle>没有待众筹的游戏</EmptyTitle>
                <EmptyDescription>
                    当前没有标记为“无游戏”的新游戏请求。
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button as-child>
                    <NuxtLink to="/add-new-game">查看新游戏请求</NuxtLink>
                </Button>
            </EmptyContent>
        </Empty>

        <Dialog v-model:open="isPaymentDialogOpen">
            <DialogContent class="overflow-hidden sm:max-w-xl">
                <DialogHeader :class="activePayment ? 'text-center' : ''">
                    <DialogTitle v-if="activePayment" class="text-2xl">
                        扫码完成赞助
                    </DialogTitle>
                    <DialogTitle v-else>
                        赞助 {{ selectedGame?.gameName || "游戏" }}
                    </DialogTitle>
                    <DialogDescription v-if="activePayment">
                        支付成功后会自动更新对应 Discussion 的众筹进度。
                    </DialogDescription>
                    <DialogDescription v-else>
                        支付成功后，Glosc Bot 会更新对应 Discussion 的众筹进度。
                    </DialogDescription>
                </DialogHeader>

                <div v-if="selectedGame" class="flex flex-col gap-5">
                    <template v-if="!activePayment">
                        <div class="flex flex-col gap-3 rounded-md border p-4">
                            <div class="flex items-start justify-between gap-4">
                                <div class="min-w-0">
                                    <div class="truncate font-medium">
                                        {{ selectedGame.gameName }}
                                    </div>
                                    <div class="text-sm text-muted-foreground">
                                        Discussion #{{
                                            selectedGame.discussion.number
                                        }}
                                        ·
                                        {{
                                            formatDate(
                                                selectedGame.discussion
                                                    .createdAt,
                                            )
                                        }}
                                    </div>
                                </div>
                                <Badge variant="secondary">
                                    {{
                                        selectedGame.steam?.price
                                            ?.finalFormatted || "价格待确认"
                                    }}
                                </Badge>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Button
                                    v-if="selectedGame.steam?.storeUrl"
                                    variant="outline"
                                    size="sm"
                                    as-child
                                >
                                    <a
                                        :href="selectedGame.steam.storeUrl"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Store data-icon="inline-start" />
                                        Steam
                                    </a>
                                </Button>
                                <Button variant="outline" size="sm" as-child>
                                    <a
                                        :href="selectedGame.discussion.url"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ExternalLink
                                            data-icon="inline-start"
                                        />
                                        GitHub
                                    </a>
                                </Button>
                            </div>
                        </div>

                        <form
                            class="flex flex-col gap-5"
                            @submit.prevent="createPayment"
                        >
                            <FieldGroup>
                                <Field
                                    :data-invalid="
                                        amountError ? true : undefined
                                    "
                                >
                                    <FieldLabel for="sponsor-amount">
                                        赞助金额
                                    </FieldLabel>
                                    <Input
                                        id="sponsor-amount"
                                        v-model="sponsorAmount"
                                        type="number"
                                        min="1"
                                        max="9999"
                                        step="0.01"
                                        inputmode="decimal"
                                        :aria-invalid="
                                            amountError ? true : undefined
                                        "
                                    />
                                    <FieldDescription>
                                        {{
                                            amountError ||
                                            `建议金额：${formatCnyAmount(
                                                getDefaultSponsorAmount(
                                                    selectedGame,
                                                ),
                                            )}`
                                        }}
                                    </FieldDescription>
                                </Field>

                                <Field>
                                    <FieldLabel for="pay-user">
                                        昵称
                                    </FieldLabel>
                                    <Input
                                        id="pay-user"
                                        v-model="payUser"
                                        maxlength="80"
                                        placeholder="可留空"
                                    />
                                </Field>

                                <Field>
                                    <FieldTitle id="payment-channel-label">
                                        支付方式
                                    </FieldTitle>
                                    <ToggleGroup
                                        :model-value="paymentChannel"
                                        type="single"
                                        variant="outline"
                                        class="w-full"
                                        aria-labelledby="payment-channel-label"
                                        @update:model-value="setPaymentChannel"
                                    >
                                        <ToggleGroupItem
                                            value="alipay"
                                            class="flex-1"
                                        >
                                            <CircleDollarSign />
                                            支付宝
                                        </ToggleGroupItem>
                                        <ToggleGroupItem
                                            value="wechat"
                                            class="flex-1"
                                        >
                                            <QrCode />
                                            微信支付
                                        </ToggleGroupItem>
                                    </ToggleGroup>
                                </Field>
                            </FieldGroup>

                            <Alert v-if="paymentError" variant="destructive">
                                <AlertCircle />
                                <AlertTitle>支付处理失败</AlertTitle>
                                <AlertDescription>
                                    {{ paymentError }}
                                </AlertDescription>
                            </Alert>

                            <Button
                                type="submit"
                                :disabled="
                                    isCreatingPayment ||
                                    isCheckingPayment ||
                                    Boolean(amountError)
                                "
                            >
                                <LoaderCircle
                                    v-if="
                                        isCreatingPayment || isCheckingPayment
                                    "
                                    data-icon="inline-start"
                                    class="animate-spin"
                                />
                                <CircleDollarSign
                                    v-else
                                    data-icon="inline-start"
                                />
                                {{ createPaymentButtonText }}
                            </Button>
                        </form>
                    </template>

                    <div v-else class="flex flex-col gap-5">
                        <div class="flex flex-col items-center gap-2">
                            <div class="text-sm text-muted-foreground">
                                支付金额
                            </div>
                            <div class="text-5xl font-bold tracking-tight">
                                {{
                                    formatCnyAmount(activePayment.record.amount)
                                }}
                            </div>
                        </div>

                        <div :class="activePaymentChannelClass">
                            {{ activePaymentChannelName }}
                            <Badge class="absolute -right-3 -top-3">
                                {{
                                    activePayment.payment.channel === "alipay"
                                        ? "推荐"
                                        : "扫码"
                                }}
                            </Badge>
                        </div>

                        <div
                            class="flex flex-col items-center justify-center gap-5 rounded-md border bg-muted/20 p-6"
                        >
                            <div
                                class="flex size-64 items-center justify-center overflow-hidden rounded-md bg-background"
                            >
                                <iframe
                                    v-if="shouldShowAlipayFrame"
                                    :src="activePaymentValue"
                                    title="支付宝支付"
                                    class="size-full bg-background"
                                />
                                <div
                                    v-else-if="shouldShowWechatQrCode"
                                    class="flex size-full items-center justify-center bg-white p-4"
                                >
                                    <QrcodeVue
                                        :value="activePaymentValue"
                                        :size="224"
                                        level="M"
                                        render-as="svg"
                                    />
                                </div>
                                <LoaderCircle
                                    v-else
                                    class="animate-spin text-muted-foreground"
                                />
                            </div>

                            <div
                                class="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                                <Smartphone class="size-4" />
                                <span>{{ paymentHelperText }}</span>
                            </div>

                            <div
                                class="text-center text-sm text-muted-foreground"
                            >
                                {{ paymentQrCaption }}
                            </div>
                        </div>

                        <Alert v-if="paymentError" variant="destructive">
                            <AlertCircle />
                            <AlertTitle>支付处理失败</AlertTitle>
                            <AlertDescription>
                                {{ paymentError }}
                            </AlertDescription>
                        </Alert>
                        <Alert v-if="paymentSuccess">
                            <BadgeCheck />
                            <AlertTitle>支付成功</AlertTitle>
                            <AlertDescription>
                                {{ paymentSuccess }}
                            </AlertDescription>
                        </Alert>

                        <div
                            class="flex flex-col items-center justify-between gap-3 sm:flex-row"
                        >
                            <div
                                class="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                                <ShieldCheck class="size-4" />
                                <span>{{ paymentSecurityText }}</span>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                :disabled="isCheckingPayment"
                                @click="refreshPaymentStatus"
                            >
                                <LoaderCircle
                                    v-if="isCheckingPayment"
                                    data-icon="inline-start"
                                    class="animate-spin"
                                />
                                <RefreshCcw v-else data-icon="inline-start" />
                                刷新状态
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    </div>
</template>
