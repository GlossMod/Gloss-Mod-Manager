<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useDark } from "@vueuse/core";
import { useRoute, useRouter } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	CheckCircle2,
	ExternalLink,
	Github,
	Link as LinkIcon,
	MessageCircle,
	PlusCircle,
	Send,
	Sparkles,
	ThumbsUp,
} from "lucide-vue-next";
import {
	SITE_URL,
	createBreadcrumbJsonLd,
	createWebPageJsonLd,
	useSeoMeta,
} from "@/lib/seo";

interface GameRequest {
	gameName: string;
	sourceUrl: string;
	modUrl: string;
}

interface GiscusMessage {
	giscus?: {
		discussion?: {
			id?: string;
			title?: string;
			url?: string;
		};
		error?: string;
	};
}

const GITHUB_REPO = "GlossMod/Gloss-Mod-Manager";
const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
const GISCUS_REPO_ID = import.meta.env.VITE_GISCUS_REPO_ID || "R_kgDOJxuy0Q";
const GISCUS_CATEGORY = "new-games";
const GISCUS_CATEGORY_ID =
	import.meta.env.VITE_GISCUS_NEW_GAMES_CATEGORY_ID ||
	import.meta.env.VITE_GISCUS_CATEGORY_ID ||
	"";

const pageTitle = "新增游戏请求";
const pageDescription =
	"在 Gloss Mod Manager 网站提交新游戏支持请求，并通过 GitHub Discussions 进行支持、评论与表情互动。";

useSeoMeta({
	title: pageTitle,
	description: pageDescription,
	path: "/add-new-game",
	keywords: ["新增游戏", "游戏支持请求", "GitHub Discussions", "GMM 支持游戏"],
	structuredData: [
		createWebPageJsonLd(pageTitle, pageDescription, "/add-new-game"),
		createBreadcrumbJsonLd([
			{ name: "首页", path: "/" },
			{ name: "新增游戏", path: "/add-new-game" },
		]),
	],
});

const route = useRoute();
const router = useRouter();
const isDark = useDark();

const readQueryValue = (value: unknown) => {
	if (Array.isArray(value)) {
		return typeof value[0] === "string" ? value[0] : "";
	}

	return typeof value === "string" ? value : "";
};

const normalizeRequest = (request: GameRequest): GameRequest => ({
	gameName: request.gameName.trim().replace(/\s+/g, " "),
	sourceUrl: request.sourceUrl.trim(),
	modUrl: request.modUrl.trim(),
});

const isHttpUrl = (value: string) => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

const initialRequest = normalizeRequest({
	gameName: readQueryValue(route.query.game),
	sourceUrl: readQueryValue(route.query.source),
	modUrl: readQueryValue(route.query.mod),
});

const form = reactive<GameRequest>({ ...initialRequest });
const submittedRequest = ref<GameRequest | null>(
	initialRequest.gameName && initialRequest.sourceUrl && initialRequest.modUrl
		? initialRequest
		: null,
);
const formError = ref("");
const copied = ref(false);
const discussionUrl = ref("");
const giscusError = ref("");
const giscusContainer = ref<HTMLDivElement | null>(null);

const isGiscusConfigured = computed(
	() => Boolean(GISCUS_REPO_ID && GISCUS_CATEGORY_ID),
);
const giscusTheme = computed(() => (isDark.value ? "dark" : "light"));

const discussionTitle = computed(() => {
	const gameName = submittedRequest.value?.gameName || "未命名游戏";
	return `新游戏请求：${gameName}`;
});

const discussionDescription = computed(() => {
	const request = submittedRequest.value;

	if (!request) {
		return pageDescription;
	}

	return [
		`游戏名称：${request.gameName}`,
		`游戏官网/商店/Steam 地址：${request.sourceUrl}`,
		`Mod 地址：${request.modUrl}`,
		"",
		"补充信息：欢迎在评论区追加适配规则、安装目录结构、测试版本或已有 Mod 生态。",
	].join("\n");
});

const requestQuery = computed(() => {
	const request = submittedRequest.value;

	if (!request) {
		return {};
	}

	return {
		game: request.gameName,
		source: request.sourceUrl,
		mod: request.modUrl,
	};
});

const requestPath = computed(() =>
	router.resolve({ path: "/add-new-game", query: requestQuery.value }).href,
);
const requestBackLink = computed(
	() => new URL(requestPath.value, `${SITE_URL}/`).href,
);
const githubCategoryUrl = `${GITHUB_REPO_URL}/discussions/categories/${GISCUS_CATEGORY}`;
const githubNewDiscussionUrl = computed(() => {
	const params = new URLSearchParams({
		category: GISCUS_CATEGORY,
		title: discussionTitle.value,
		body: discussionDescription.value,
	});

	return `${GITHUB_REPO_URL}/discussions/new?${params.toString()}`;
});

const requestFields = computed(() => [
	{ label: "游戏名称", value: submittedRequest.value?.gameName || "" },
	{ label: "官网/商店/Steam", value: submittedRequest.value?.sourceUrl || "" },
	{ label: "Mod 地址", value: submittedRequest.value?.modUrl || "" },
]);

const validateForm = () => {
	const request = normalizeRequest(form);

	if (!request.gameName) {
		return "请输入游戏名称。";
	}

	if (!request.sourceUrl || !isHttpUrl(request.sourceUrl)) {
		return "请输入有效的游戏官网、商店或 Steam 地址。";
	}

	if (!request.modUrl || !isHttpUrl(request.modUrl)) {
		return "请输入有效的 Mod 地址。";
	}

	return "";
};

const setMetaContent = (
	attributeName: "name" | "property",
	key: string,
	content: string,
) => {
	let meta = document.head.querySelector<HTMLMetaElement>(
		`meta[${attributeName}="${key}"]`,
	);

	if (!meta) {
		meta = document.createElement("meta");
		meta.setAttribute(attributeName, key);
		document.head.appendChild(meta);
	}

	meta.content = content;
};

const syncGiscusMeta = () => {
	if (typeof document === "undefined") {
		return;
	}

	setMetaContent("name", "description", discussionDescription.value);
	setMetaContent("property", "og:description", discussionDescription.value);
	setMetaContent("name", "giscus:backlink", requestBackLink.value);
};

const restorePageMeta = () => {
	if (typeof document === "undefined") {
		return;
	}

	setMetaContent("name", "description", pageDescription);
	setMetaContent("property", "og:description", pageDescription);
	document.head.querySelector('meta[name="giscus:backlink"]')?.remove();
};

const loadGiscus = async () => {
	if (!submittedRequest.value || !isGiscusConfigured.value) {
		return;
	}

	await nextTick();

	const container = giscusContainer.value;

	if (!container) {
		return;
	}

	syncGiscusMeta();
	container.innerHTML = "";

	const script = document.createElement("script");
	script.src = "https://giscus.app/client.js";
	script.async = true;
	script.crossOrigin = "anonymous";

	const attributes: Record<string, string> = {
		repo: GITHUB_REPO,
		"repo-id": GISCUS_REPO_ID,
		category: GISCUS_CATEGORY,
		"category-id": GISCUS_CATEGORY_ID,
		mapping: "specific",
		term: discussionTitle.value,
		strict: "1",
		"reactions-enabled": "1",
		"emit-metadata": "1",
		"input-position": "top",
		theme: giscusTheme.value,
		lang: "zh-CN",
		loading: "lazy",
	};

	Object.entries(attributes).forEach(([name, value]) => {
		script.setAttribute(`data-${name}`, value);
	});

	container.appendChild(script);
};

const updateGiscusTheme = () => {
	const iframe = document.querySelector<HTMLIFrameElement>("iframe.giscus-frame");

	iframe?.contentWindow?.postMessage(
		{ giscus: { setConfig: { theme: giscusTheme.value } } },
		"https://giscus.app",
	);
};

const submitRequest = async () => {
	const error = validateForm();

	if (error) {
		formError.value = error;
		return;
	}

	const request = normalizeRequest(form);
	formError.value = "";
	copied.value = false;
	discussionUrl.value = "";
	giscusError.value = "";
	submittedRequest.value = request;

	await router.replace({ path: "/add-new-game", query: requestQuery.value });
	await loadGiscus();
};

const resetRequest = () => {
	form.gameName = "";
	form.sourceUrl = "";
	form.modUrl = "";
	submittedRequest.value = null;
	formError.value = "";
	copied.value = false;
	discussionUrl.value = "";
	giscusError.value = "";
	giscusContainer.value?.replaceChildren();
	restorePageMeta();
	void router.replace({ path: "/add-new-game" });
};

const copyRequestLink = async () => {
	if (!submittedRequest.value) {
		return;
	}

	await navigator.clipboard.writeText(requestBackLink.value);
	copied.value = true;

	window.setTimeout(() => {
		copied.value = false;
	}, 1800);
};

const handleGiscusMessage = (event: MessageEvent<GiscusMessage>) => {
	if (event.origin !== "https://giscus.app") {
		return;
	}

	if (event.data.giscus?.discussion?.url) {
		discussionUrl.value = event.data.giscus.discussion.url;
	}

	if (event.data.giscus?.error) {
		giscusError.value = event.data.giscus.error;
	}
};

watch(giscusTheme, updateGiscusTheme);

onMounted(() => {
	window.addEventListener("message", handleGiscusMessage);

	if (submittedRequest.value) {
		void loadGiscus();
	}
});

onBeforeUnmount(() => {
	window.removeEventListener("message", handleGiscusMessage);
});
</script>

<template>
	<div class="container mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
		<section class="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
			<div class="space-y-6">
				<div class="space-y-4">
					<Badge variant="outline" class="w-fit gap-2">
						<Github class="h-3.5 w-3.5" />
						GitHub Discussions
					</Badge>
					<div class="space-y-3">
						<h1 class="text-3xl font-bold tracking-tight md:text-4xl">
							新增游戏请求
						</h1>
						<p class="max-w-2xl text-muted-foreground">
							填写游戏与 Mod 线索后，可直接在站内完成 GitHub 登录、支持、评论和表情互动，内容会同步到 new-games 分类。
						</p>
					</div>
				</div>

				<div class="grid gap-3 sm:grid-cols-3">
					<div class="rounded-lg border bg-muted/20 p-4">
						<Github class="mb-3 h-5 w-5 text-foreground" />
						<div class="text-sm font-medium">GitHub 登录</div>
						<div class="mt-1 text-sm text-muted-foreground">
							giscus OAuth
						</div>
					</div>
					<div class="rounded-lg border bg-muted/20 p-4">
						<ThumbsUp class="mb-3 h-5 w-5 text-foreground" />
						<div class="text-sm font-medium">支持</div>
						<div class="mt-1 text-sm text-muted-foreground">
							主贴 reaction
						</div>
					</div>
					<div class="rounded-lg border bg-muted/20 p-4">
						<MessageCircle class="mb-3 h-5 w-5 text-foreground" />
						<div class="text-sm font-medium">评论</div>
						<div class="mt-1 text-sm text-muted-foreground">
							Discussions 回复
						</div>
					</div>
				</div>

				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2 text-xl">
							<PlusCircle class="h-5 w-5" />
							新建游戏请求
						</CardTitle>
						<CardDescription>
							游戏线索会作为 GitHub Discussions 首贴内容，用于后续适配排期与社区补充。
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form class="space-y-5" @submit.prevent="submitRequest">
							<div class="space-y-2">
								<label for="game-name" class="text-sm font-medium">
									游戏名称
								</label>
								<input
									id="game-name"
									v-model="form.gameName"
									type="text"
									maxlength="80"
									autocomplete="off"
									placeholder="例如：Stellar Blade"
									class="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								/>
							</div>

							<div class="space-y-2">
								<label for="source-url" class="text-sm font-medium">
									游戏官网 / 商店 / Steam 地址
								</label>
								<input
									id="source-url"
									v-model="form.sourceUrl"
									type="url"
									inputmode="url"
									autocomplete="url"
									placeholder="https://store.steampowered.com/app/..."
									class="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								/>
							</div>

							<div class="space-y-2">
								<label for="mod-url" class="text-sm font-medium">
									Mod 地址
								</label>
								<input
									id="mod-url"
									v-model="form.modUrl"
									type="url"
									inputmode="url"
									autocomplete="url"
									placeholder="https://www.nexusmods.com/..."
									class="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								/>
							</div>

							<p v-if="formError" class="text-sm text-destructive">
								{{ formError }}
							</p>

							<div class="flex flex-col gap-3 sm:flex-row">
								<Button type="submit" class="w-full sm:w-auto">
									<Send class="mr-2 h-4 w-4" />
									新建游戏请求
								</Button>
								<Button
									type="button"
									variant="outline"
									class="w-full sm:w-auto"
									@click="resetRequest"
								>
									重置
								</Button>
								<Button
									variant="link"
									as="a"
									:href="githubCategoryUrl"
									target="_blank"
									rel="noreferrer"
									class="w-full px-0 sm:w-auto"
								>
									GitHub 分类
									<ExternalLink class="ml-2 h-4 w-4" />
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</div>

			<div class="space-y-6">
				<Card v-if="submittedRequest">
					<CardHeader>
						<div class="mb-2 flex flex-wrap items-center gap-2">
							<Badge variant="secondary" class="gap-1.5">
								<CheckCircle2 class="h-3.5 w-3.5" />
								已准备同步
							</Badge>
							<Badge variant="outline">new-games</Badge>
						</div>
						<CardTitle class="text-2xl leading-tight">
							{{ discussionTitle }}
						</CardTitle>
						<CardDescription>
							首次支持、评论或表情会触发 giscus 在 GitHub Discussions 中创建对应帖子。
						</CardDescription>
					</CardHeader>
					<CardContent class="space-y-6">
						<dl class="grid gap-4">
							<div
								v-for="field in requestFields"
								:key="field.label"
								class="rounded-lg border bg-muted/20 p-4"
							>
								<dt class="text-xs font-medium uppercase text-muted-foreground">
									{{ field.label }}
								</dt>
								<dd class="mt-2 break-words text-sm font-medium">
									<a
										v-if="field.value.startsWith('http')"
										:href="field.value"
										target="_blank"
										rel="noreferrer"
										class="inline-flex items-center gap-1.5 hover:underline"
									>
										{{ field.value }}
										<ExternalLink class="h-3.5 w-3.5 shrink-0" />
									</a>
									<span v-else>{{ field.value }}</span>
								</dd>
							</div>
						</dl>

						<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
							<Button
								variant="outline"
								as="a"
								:href="discussionUrl || githubNewDiscussionUrl"
								target="_blank"
								rel="noreferrer"
								class="w-full sm:w-auto"
							>
								<Github class="mr-2 h-4 w-4" />
								{{ discussionUrl ? "打开讨论" : "GitHub 提交" }}
							</Button>
							<Button
								variant="secondary"
								type="button"
								class="w-full sm:w-auto"
								@click="copyRequestLink"
							>
								<LinkIcon class="mr-2 h-4 w-4" />
								{{ copied ? "已复制" : "复制请求链接" }}
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card v-else class="border-dashed bg-muted/15">
					<CardHeader>
						<Badge variant="outline" class="mb-2 w-fit gap-2">
							<Sparkles class="h-3.5 w-3.5" />
							待提交
						</Badge>
						<CardTitle class="text-2xl">请求预览会显示在这里</CardTitle>
						<CardDescription>
							提交后将生成独立 discussion 标题、首贴内容和站内互动区域。
						</CardDescription>
					</CardHeader>
				</Card>

				<section v-if="submittedRequest" class="space-y-4">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 class="text-xl font-semibold tracking-tight">
								支持与评论
							</h2>
							<p class="mt-1 text-sm text-muted-foreground">
								GitHub 登录、表情、支持和评论由 giscus 同步处理。
							</p>
						</div>
						<Badge variant="outline" class="gap-2">
							<MessageCircle class="h-3.5 w-3.5" />
							Discussions
						</Badge>
					</div>

					<div
						v-if="isGiscusConfigured"
						ref="giscusContainer"
						class="giscus-host min-h-64 rounded-lg border bg-background p-4"
					></div>

					<div
						v-else
						class="rounded-lg border border-dashed bg-muted/20 p-5"
					>
						<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
							<div class="space-y-1">
								<h3 class="font-semibold">站内互动配置未完成</h3>
								<p class="text-sm text-muted-foreground">
									部署环境需要配置 VITE_GISCUS_NEW_GAMES_CATEGORY_ID，并确保仓库已安装 giscus app。
								</p>
							</div>
							<Button
								as="a"
								:href="githubNewDiscussionUrl"
								target="_blank"
								rel="noreferrer"
								class="w-full md:w-auto"
							>
								<Github class="mr-2 h-4 w-4" />
								在 GitHub 创建
							</Button>
						</div>
					</div>

					<p v-if="giscusError" class="text-sm text-destructive">
						{{ giscusError }}
					</p>
				</section>
			</div>
		</section>
	</div>
</template>

<style scoped>
.giscus-host :deep(.giscus-frame) {
	width: 100%;
	border: 0;
}
</style>
