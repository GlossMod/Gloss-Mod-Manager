import {
    extractJsonMiddleware,
    generateText,
    NoObjectGeneratedError,
    Output,
    wrapLanguageModel,
} from "ai";
import { z } from "zod";
import { languageOptions, type AppLocale } from "@/lang/locales";
import { AiChat } from "@/lib/AiChat";

const TRANSLATION_CHUNK_SIZE = 12;
const MAX_DESCRIPTION_LENGTH = 12000;
const TRANSLATION_PROMPT_VERSION = 2;

export interface IExploreTranslationSourceItem {
    id: string;
    title?: string;
    summary?: string;
    description?: string;
    typeName?: string;
    categories?: string[];
    tags?: string[];
    resourceName?: string;
}

export interface IExploreTranslationEntry {
    id: string;
    title: string;
    summary: string;
    description: string;
    typeName: string;
    categories: string[];
    tags: string[];
    resourceName: string;
}

export interface IExploreTranslationRequest {
    baseUrl: string;
    apiKey: string;
    modelId?: string;
    targetLocale: AppLocale;
    source: string;
    items: IExploreTranslationSourceItem[];
    abortSignal?: AbortSignal;
}

interface IPreparedTranslationItem extends IExploreTranslationEntry {
    cacheKey: string;
}

const translatedStringSchema = z
    .preprocess((value) => {
        if (value === null || value === undefined) {
            return "";
        }

        return typeof value === "string" ? value : String(value);
    }, z.string())
    .catch("");

const translatedStringArraySchema = z
    .preprocess((value) => {
        if (Array.isArray(value)) {
            return value.map((item) => {
                return typeof item === "string" ? item : String(item ?? "");
            });
        }

        if (typeof value === "string" && value.trim()) {
            return [value];
        }

        return [];
    }, z.array(z.string()))
    .catch([]);

const translationEntrySchema = z.object({
    id: translatedStringSchema.describe(
        "Input item id. Must be copied exactly.",
    ),
    title: translatedStringSchema,
    summary: translatedStringSchema,
    description: translatedStringSchema,
    typeName: translatedStringSchema,
    categories: translatedStringArraySchema,
    tags: translatedStringArraySchema,
    resourceName: translatedStringSchema,
});

const translationResultSchema = z.preprocess(
    (value) => {
        if (Array.isArray(value)) {
            return {
                items: value,
            };
        }

        return value;
    },
    z.object({
        items: z.array(translationEntrySchema),
    }),
);

const translationCache = new Map<string, IExploreTranslationEntry>();

function toErrorMessage(error: unknown, fallbackMessage: string) {
    if (NoObjectGeneratedError.isInstance(error)) {
        return "AI 未返回有效的翻译 JSON，请稍后重试或更换模型。";
    }

    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    if (typeof error === "string" && error.trim()) {
        return error;
    }

    return fallbackMessage;
}

function normalizeText(value?: string) {
    return (value ?? "").replace(/\s+/gu, " ").trim();
}

function normalizeLongText(value?: string) {
    const normalized = (value ?? "").trim();

    if (normalized.length <= MAX_DESCRIPTION_LENGTH) {
        return normalized;
    }

    return normalized.slice(0, MAX_DESCRIPTION_LENGTH);
}

function normalizeTextArray(value?: string[]) {
    return (value ?? []).map((item) => normalizeText(item)).filter(Boolean);
}

function hasTranslatableText(item: IExploreTranslationEntry) {
    return Boolean(
        item.title ||
        item.summary ||
        item.description ||
        item.typeName ||
        item.resourceName ||
        item.categories.length ||
        item.tags.length,
    );
}

function createCacheKey(
    targetLocale: AppLocale,
    source: string,
    item: IExploreTranslationEntry,
) {
    return JSON.stringify({
        promptVersion: TRANSLATION_PROMPT_VERSION,
        targetLocale,
        source,
        id: item.id,
        title: item.title,
        summary: item.summary,
        description: item.description,
        typeName: item.typeName,
        categories: item.categories,
        tags: item.tags,
        resourceName: item.resourceName,
    });
}

function prepareTranslationItem(
    targetLocale: AppLocale,
    source: string,
    item: IExploreTranslationSourceItem,
): IPreparedTranslationItem | null {
    const normalizedItem: IExploreTranslationEntry = {
        id: normalizeText(item.id),
        title: normalizeText(item.title),
        summary: normalizeText(item.summary),
        description: normalizeLongText(item.description),
        typeName: normalizeText(item.typeName),
        categories: normalizeTextArray(item.categories),
        tags: normalizeTextArray(item.tags),
        resourceName: normalizeText(item.resourceName),
    };

    if (!normalizedItem.id || !hasTranslatableText(normalizedItem)) {
        return null;
    }

    return {
        ...normalizedItem,
        cacheKey: createCacheKey(targetLocale, source, normalizedItem),
    };
}

function normalizeTranslatedEntry(
    entry: z.infer<typeof translationEntrySchema> | undefined,
    fallback: IPreparedTranslationItem,
): IExploreTranslationEntry {
    return {
        id: fallback.id,
        title: normalizeText(entry?.title) || fallback.title,
        summary: normalizeText(entry?.summary) || fallback.summary,
        description: (entry?.description ?? "").trim() || fallback.description,
        typeName: normalizeText(entry?.typeName) || fallback.typeName,
        categories: normalizeTextArray(entry?.categories),
        tags: normalizeTextArray(entry?.tags),
        resourceName:
            normalizeText(entry?.resourceName) || fallback.resourceName,
    };
}

function getTargetLanguage(locale: AppLocale) {
    return (
        languageOptions.find((item) => item.value === locale) ??
        languageOptions[0]
    );
}

function chunkItems<T>(items: T[], size: number) {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }

    return chunks;
}

async function resolveModel(baseUrl: string, apiKey: string, modelId?: string) {
    const service = new AiChat(baseUrl, apiKey);
    const normalizedModelId = normalizeText(modelId);

    if (normalizedModelId) {
        return {
            service,
            modelId: normalizedModelId,
        };
    }

    const models = await service.getModels();
    const firstModelId = models[0]?.id?.trim() ?? "";

    if (!firstModelId) {
        throw new Error("未找到可用的 AI 模型，请检查 AI 配置。");
    }

    return {
        service,
        modelId: firstModelId,
    };
}

function buildTranslationPrompt(
    source: string,
    targetLocale: AppLocale,
    items: IPreparedTranslationItem[],
) {
    const targetLanguage = getTargetLanguage(targetLocale);
    const payload = {
        source,
        targetLocale,
        targetLanguage: targetLanguage.nativeName,
        items: items.map(({ cacheKey: _cacheKey, ...item }) => item),
    };

    return [
        `请把下面 JSON 中的 Mod 展示文本翻译为 ${targetLanguage.nativeName}（${targetLocale.replace("_", "-")}）。`,
        '必须返回 JSON 对象，格式为 { "items": [...] }，不要返回裸数组或额外说明。',
        "只翻译 title、summary、description、typeName、categories、tags、resourceName 这些展示文本。",
        "title 必须按标题语义翻译，保留游戏名、人名、Mod 名等专有名词片段即可，不要因为包含专有名词就整句原样返回。",
        "description 即使包含 HTML、BBCode 或 Markdown，也要翻译其中可读的自然语言内容，可以保留换行，不要保留标签或代码块。",
        "id 必须逐字复制；items 数量、顺序、数组字段长度和顺序必须与输入一致。",
        "如果某个字段为空、是版本号/文件扩展名/纯专有名词，或已经是目标语言，请原样返回。",
        "不要把英文标题、介绍整段原样返回，除非整段没有可翻译的自然语言含义。",
        "输入 JSON：",
        JSON.stringify(payload),
    ].join("\n");
}

async function translateChunk(
    request: IExploreTranslationRequest,
    items: IPreparedTranslationItem[],
) {
    const { service, modelId } = await resolveModel(
        request.baseUrl,
        request.apiKey,
        request.modelId,
    );
    const model = wrapLanguageModel({
        model: service.Agent.chatModel(modelId),
        middleware: extractJsonMiddleware(),
    });
    const result = await generateText({
        model,
        output: Output.object({
            name: "ExploreModTranslations",
            description: "Translated display-only text for mod browsing cards.",
            schema: translationResultSchema,
        }),
        instructions:
            "你是 Gloss Mod Manager 的 Mod 元数据翻译器。只返回符合 schema 的 JSON，不要改写任何功能字段。",
        prompt: buildTranslationPrompt(
            request.source,
            request.targetLocale,
            items,
        ),
        temperature: 0,
        maxRetries: 1,
        timeout: 60000,
        abortSignal: request.abortSignal,
    });
    const resultItems = result.output.items;
    const resultMap = new Map(resultItems.map((item) => [item.id, item]));

    return Object.fromEntries(
        items.map((item, index) => {
            const translated = normalizeTranslatedEntry(
                resultMap.get(item.id) ?? resultItems[index],
                item,
            );

            translationCache.set(item.cacheKey, translated);

            return [item.id, translated];
        }),
    ) as Record<string, IExploreTranslationEntry>;
}

export async function translateExploreItems(
    request: IExploreTranslationRequest,
) {
    const normalizedBaseUrl = request.baseUrl.trim();
    const normalizedApiKey = request.apiKey.trim();

    if (!normalizedBaseUrl || !normalizedApiKey) {
        throw new Error("请先在设置页完成 AI 配置。");
    }

    const preparedItems = request.items
        .map((item) =>
            prepareTranslationItem(request.targetLocale, request.source, item),
        )
        .filter((item): item is IPreparedTranslationItem => Boolean(item));
    const translatedMap: Record<string, IExploreTranslationEntry> = {};
    const pendingItems: IPreparedTranslationItem[] = [];

    for (const item of preparedItems) {
        const cached = translationCache.get(item.cacheKey);

        if (cached) {
            translatedMap[item.id] = cached;
            continue;
        }

        pendingItems.push(item);
    }

    for (const chunk of chunkItems(pendingItems, TRANSLATION_CHUNK_SIZE)) {
        Object.assign(translatedMap, await translateChunk(request, chunk));
    }

    return translatedMap;
}

export function getExploreTranslationErrorMessage(
    error: unknown,
    fallbackMessage = "AI 翻译失败。",
) {
    return toErrorMessage(error, fallbackMessage);
}
