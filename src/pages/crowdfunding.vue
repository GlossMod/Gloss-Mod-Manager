<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
    AlertCircle,
    BadgeCheck,
    CircleDollarSign,
    Copy,
    ExternalLink,
    Gamepad2,
    HeartHandshake,
    LogIn,
    LoaderCircle,
    QrCode,
    RefreshCcw,
    Store,
} from "@lucide/vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import type { AuthSessionResponse } from "@/lib/new-game-discussions";

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
const { data: authSession } = await useFetch<AuthSessionResponse>(
    "/api/auth/session",
    {
        default: () => ({
            isConfigured: false,
            isLoggedIn: false,
            viewer: null,
        }),
    },
);

const selectedGame = ref<CrowdfundingGame | null>(null);
const isPaymentDialogOpen = ref(false);
const sponsorAmount = ref("10.00");
const payUser = ref("");
const paymentChannel = ref<CrowdfundingPaymentChannel>("alipay");
const activePayment = ref<CrowdfundingPaymentResponse | null>(null);
const paymentError = ref("");
const copyMessage = ref("");
const isCreatingPayment = ref(false);
const isCheckingPayment = ref(false);

const games = computed(() => crowdfundingData.value?.games || []);
const loginUrl = computed(
    () =>
        `/api/auth/github/login?redirect=${encodeURIComponent(
            "/crowdfunding",
        )}`,
);
const needsGitHubLoginForPayment = computed(
    () =>
        Boolean(authSession.value?.isConfigured) &&
        !authSession.value?.isLoggedIn,
);
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
const selectedPaymentStatus = computed(() => {
    if (!activePayment.value) {
        return "";
    }

    const status = activePayment.value.record.status;

    if (status === "paid") {
        return "支付已确认，GitHub 记录已更新。";
    }

    if (status === "closed") {
        return "订单已关闭。";
    }

    return "订单已创建，等待支付确认。";
});
const createPaymentButtonText = computed(() => {
    if (isCreatingPayment.value) {
        return "正在创建订单";
    }

    if (needsGitHubLoginForPayment.value) {
        return "请先登录 GitHub";
    }

    return `创建${getPaymentChannelName(paymentChannel.value)}订单`;
});

const formatDate = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
    }).format(new Date(value));

const formatAmountInput = (amount: number) =>
    Math.min(Math.max(amount, 1), 9999).toFixed(2);

const getDefaultSponsorAmount = (game: CrowdfundingGame) => {
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
    copyMessage.value = "";
    isPaymentDialogOpen.value = true;
};

const setPaymentChannel = (value: string | string[] | undefined) => {
    if (value === "alipay" || value === "wechat") {
        paymentChannel.value = value;
    }
};

const redirectToGitHubLogin = () => {
    if (typeof window !== "undefined") {
        window.location.assign(loginUrl.value);
    }
};

const createPayment = async () => {
    if (!selectedGame.value || amountError.value) {
        return;
    }

    if (needsGitHubLoginForPayment.value) {
        paymentError.value = "创建支付订单前需要先登录 GitHub。";
        redirectToGitHubLogin();
        return;
    }

    paymentError.value = "";
    copyMessage.value = "";
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

        activePayment.value = response;
        replaceGame(response.game);
    } catch (error) {
        paymentError.value =
            error instanceof Error ? error.message : "创建支付单失败。";
    } finally {
        isCreatingPayment.value = false;
    }
};

const refreshPaymentStatus = async () => {
    if (!activePayment.value) {
        return;
    }

    paymentError.value = "";
    isCheckingPayment.value = true;

    try {
        const response = await $fetch<CrowdfundingPaymentStatusResponse>(
            "/api/crowdfunding/pay/status",
            {
                method: "POST",
                body: {
                    discussionNumber:
                        activePayment.value.game.discussion.number,
                    outTradeNo: activePayment.value.payment.outTradeNo,
                    channel: activePayment.value.payment.channel,
                },
            },
        );

        activePayment.value = {
            ...activePayment.value,
            game: response.game,
            record: response.record,
        };
        replaceGame(response.game);

        if (response.isPaid) {
            await refresh();
        }
    } catch (error) {
        paymentError.value =
            error instanceof Error ? error.message : "刷新支付状态失败。";
    } finally {
        isCheckingPayment.value = false;
    }
};

const copyWechatCode = async () => {
    if (!activePayment.value?.payment.codeUrl) {
        return;
    }

    try {
        await navigator.clipboard.writeText(
            activePayment.value.payment.codeUrl,
        );
        copyMessage.value = "已复制微信支付链接。";
    } catch {
        copyMessage.value = "复制失败，请手动选择支付链接。";
    }
};

watch(isPaymentDialogOpen, (isOpen) => {
    if (!isOpen) {
        activePayment.value = null;
        paymentError.value = "";
        copyMessage.value = "";
    }
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

        <div
            v-if="isLoading"
            class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
            <Card v-for="index in 6" :key="index" class="overflow-hidden">
                <Skeleton class="aspect-460/215 rounded-none" />
                <CardHeader>
                    <Skeleton class="h-6 w-3/4" />
                    <Skeleton class="h-4 w-full" />
                </CardHeader>
                <CardContent class="flex flex-col gap-4">
                    <Skeleton class="h-2 w-full" />
                    <div class="grid grid-cols-3 gap-3">
                        <Skeleton class="h-10" />
                        <Skeleton class="h-10" />
                        <Skeleton class="h-10" />
                    </div>
                </CardContent>
                <CardFooter>
                    <Skeleton class="h-10 w-full" />
                </CardFooter>
            </Card>
        </div>

        <div
            v-else-if="games.length"
            class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
            <Card
                v-for="game in games"
                :key="game.discussion.number"
                class="overflow-hidden"
            >
                <div class="aspect-460/215 bg-muted">
                    <img
                        v-if="game.steam?.headerImage"
                        :src="game.steam.headerImage"
                        :alt="`${game.gameName} Steam 封面`"
                        loading="lazy"
                        decoding="async"
                        referrerpolicy="no-referrer"
                        class="h-full w-full object-cover"
                    />
                    <div
                        v-else
                        class="flex h-full items-center justify-center text-muted-foreground"
                    >
                        <Gamepad2 class="size-10" />
                    </div>
                </div>

                <CardHeader>
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
                    </div>
                    <CardTitle class="line-clamp-2">
                        {{ game.gameName }}
                    </CardTitle>
                    <CardDescription class="line-clamp-2">
                        {{
                            game.steam?.shortDescription ||
                            game.additionalInfo ||
                            "这个请求还在等待游戏本体。"
                        }}
                    </CardDescription>
                </CardHeader>

                <CardContent class="flex flex-col gap-5">
                    <div class="flex flex-col gap-2">
                        <div
                            class="flex items-center justify-between gap-3 text-sm"
                        >
                            <span class="text-muted-foreground">众筹进度</span>
                            <span class="font-medium">
                                {{ game.funding.progress }}%
                            </span>
                        </div>
                        <Progress :model-value="game.funding.progress" />
                    </div>

                    <div class="grid grid-cols-3 gap-3 text-sm">
                        <div class="flex flex-col gap-1 rounded-md border p-3">
                            <span class="text-muted-foreground">目标</span>
                            <span class="font-medium">
                                {{ formatCnyAmount(game.funding.targetAmount) }}
                            </span>
                        </div>
                        <div class="flex flex-col gap-1 rounded-md border p-3">
                            <span class="text-muted-foreground">已筹</span>
                            <span class="font-medium">
                                {{ formatCnyAmount(game.funding.raisedAmount) }}
                            </span>
                        </div>
                        <div class="flex flex-col gap-1 rounded-md border p-3">
                            <span class="text-muted-foreground">赞助</span>
                            <span class="font-medium">
                                {{ game.funding.backerCount }}
                            </span>
                        </div>
                    </div>
                </CardContent>

                <CardFooter class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                        class="w-full"
                        :disabled="
                            game.funding.targetAmount !== null &&
                            game.funding.raisedAmount >=
                                game.funding.targetAmount
                        "
                        @click="openPaymentDialog(game)"
                    >
                        <HeartHandshake data-icon="inline-start" />
                        {{
                            game.funding.targetAmount !== null &&
                            game.funding.raisedAmount >=
                                game.funding.targetAmount
                                ? "已完成"
                                : "赞助这款"
                        }}
                    </Button>
                    <Button variant="outline" class="w-full" as-child>
                        <a
                            :href="game.discussion.url"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            讨论
                            <ExternalLink data-icon="inline-end" />
                        </a>
                    </Button>
                </CardFooter>
            </Card>
        </div>

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
            <DialogContent class="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        赞助 {{ selectedGame?.gameName || "游戏" }}
                    </DialogTitle>
                    <DialogDescription>
                        订单会先写入对应
                        Discussion，支付确认后同一条记录会更新为已确认。
                    </DialogDescription>
                </DialogHeader>

                <div v-if="selectedGame" class="flex flex-col gap-5">
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
                                            selectedGame.discussion.createdAt,
                                        )
                                    }}
                                </div>
                            </div>
                            <Badge variant="secondary">
                                {{
                                    selectedGame.steam?.price?.finalFormatted ||
                                    "价格待确认"
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
                                    <ExternalLink data-icon="inline-start" />
                                    GitHub
                                </a>
                            </Button>
                        </div>
                    </div>

                    <Alert v-if="needsGitHubLoginForPayment">
                        <LogIn />
                        <AlertTitle>需要 GitHub 登录</AlertTitle>
                        <AlertDescription class="flex flex-col gap-3">
                            <span>
                                支付订单需要先写入对应 Discussion 作为记录。
                            </span>
                            <Button size="sm" class="w-fit" as-child>
                                <a :href="loginUrl">
                                    <LogIn data-icon="inline-start" />
                                    登录 GitHub
                                </a>
                            </Button>
                        </AlertDescription>
                    </Alert>

                    <form
                        class="flex flex-col gap-5"
                        @submit.prevent="createPayment"
                    >
                        <FieldGroup>
                            <Field
                                :data-invalid="amountError ? true : undefined"
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
                                <FieldLabel for="pay-user"> 昵称 </FieldLabel>
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
                                Boolean(amountError) ||
                                needsGitHubLoginForPayment
                            "
                        >
                            <LoaderCircle
                                v-if="isCreatingPayment"
                                data-icon="inline-start"
                                class="animate-spin"
                            />
                            <CircleDollarSign
                                v-else-if="!needsGitHubLoginForPayment"
                                data-icon="inline-start"
                            />
                            <LogIn v-else data-icon="inline-start" />
                            {{ createPaymentButtonText }}
                        </Button>
                    </form>

                    <div
                        v-if="activePayment"
                        class="flex flex-col gap-4 rounded-md border bg-muted/20 p-4"
                    >
                        <div class="flex flex-col gap-1">
                            <div class="text-sm font-medium">
                                {{ selectedPaymentStatus }}
                            </div>
                            <div
                                class="break-all text-xs text-muted-foreground"
                            >
                                {{ activePayment.payment.outTradeNo }}
                            </div>
                            <div
                                v-if="activePayment.payment.codeUrl"
                                class="break-all text-xs text-muted-foreground"
                            >
                                {{ activePayment.payment.codeUrl }}
                            </div>
                        </div>

                        <div class="flex flex-col gap-2 sm:flex-row">
                            <Button
                                v-if="activePayment.payment.payUrl"
                                class="w-full"
                                as-child
                            >
                                <a
                                    :href="activePayment.payment.payUrl"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    前往支付
                                    <ExternalLink data-icon="inline-end" />
                                </a>
                            </Button>
                            <Button
                                v-if="activePayment.payment.codeUrl"
                                type="button"
                                class="w-full"
                                @click="copyWechatCode"
                            >
                                <Copy data-icon="inline-start" />
                                复制微信支付链接
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                class="w-full"
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

                        <div
                            v-if="copyMessage"
                            class="text-sm text-muted-foreground"
                        >
                            {{ copyMessage }}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    </div>
</template>
