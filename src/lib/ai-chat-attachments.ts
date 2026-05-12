import type { FileUIPart } from "ai";

const FALLBACK_ATTACHMENT_MEDIA_TYPE = "application/octet-stream";
const ATTACHMENT_TEXT_PREVIEW_LIMIT = 6000;

const EXTENSION_MEDIA_TYPE_MAP: Record<string, string> = {
    bat: "text/plain",
    cfg: "text/plain",
    conf: "text/plain",
    config: "text/plain",
    css: "text/css",
    csv: "text/csv",
    cts: "application/typescript",
    cjs: "application/javascript",
    geojson: "application/geo+json",
    htm: "text/html",
    html: "text/html",
    ini: "text/plain",
    js: "application/javascript",
    json: "application/json",
    jsonc: "application/json",
    log: "text/plain",
    markdown: "text/markdown",
    md: "text/markdown",
    mjs: "application/javascript",
    mts: "application/typescript",
    ps1: "text/plain",
    sh: "text/plain",
    sql: "application/sql",
    svg: "image/svg+xml",
    toml: "application/toml",
    ts: "application/typescript",
    tsv: "text/tab-separated-values",
    txt: "text/plain",
    vue: "text/plain",
    xml: "application/xml",
    yaml: "application/yaml",
    yml: "application/yaml",
};

const FILENAME_MEDIA_TYPE_MAP: Record<string, string> = {
    ".editorconfig": "text/plain",
    ".env": "text/plain",
    ".gitconfig": "text/plain",
    dockerfile: "text/plain",
    license: "text/plain",
    makefile: "text/plain",
    readme: "text/plain",
};

function getFileExtension(filename?: string) {
    const normalizedFilename = filename?.trim().toLowerCase() ?? "";
    const extensionIndex = normalizedFilename.lastIndexOf(".");

    if (
        extensionIndex <= 0 ||
        extensionIndex === normalizedFilename.length - 1
    ) {
        return "";
    }

    return normalizedFilename.slice(extensionIndex + 1);
}

function normalizeFilename(filename?: string) {
    return filename?.trim().toLowerCase() ?? "";
}

function normalizeMediaType(mediaType?: string) {
    return mediaType?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function parseDataUrl(url: string) {
    if (!url.startsWith("data:")) {
        return null;
    }

    const commaIndex = url.indexOf(",");

    if (commaIndex < 0) {
        return null;
    }

    const metadata = url.slice(5, commaIndex);
    const encodedData = url.slice(commaIndex + 1);
    const metadataParts = metadata
        .split(";")
        .map((part) => {
            return part.trim().toLowerCase();
        })
        .filter(Boolean);

    return {
        mediaType: metadataParts.find((part) => {
            return part.includes("/");
        }),
        encodedData,
        isBase64: metadataParts.includes("base64"),
    };
}

function decodeBase64ToUtf8(base64: string) {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => {
        return character.charCodeAt(0);
    });

    return new TextDecoder("utf-8").decode(bytes);
}

function truncateAttachmentText(text: string) {
    if (text.length <= ATTACHMENT_TEXT_PREVIEW_LIMIT) {
        return text;
    }

    return `${text.slice(0, ATTACHMENT_TEXT_PREVIEW_LIMIT)}\n\n[附件内容过长，已截断]`;
}

export function resolveAiChatAttachmentMediaType(
    mediaType?: string,
    filename?: string,
) {
    const normalizedMediaType = normalizeMediaType(mediaType);

    if (
        normalizedMediaType &&
        normalizedMediaType !== FALLBACK_ATTACHMENT_MEDIA_TYPE
    ) {
        return normalizedMediaType;
    }

    const inferredMediaType =
        EXTENSION_MEDIA_TYPE_MAP[getFileExtension(filename)];

    if (inferredMediaType) {
        return inferredMediaType;
    }

    const filenameMediaType =
        FILENAME_MEDIA_TYPE_MAP[normalizeFilename(filename)];

    if (filenameMediaType) {
        return filenameMediaType;
    }

    return normalizedMediaType || FALLBACK_ATTACHMENT_MEDIA_TYPE;
}

export function isAiChatTextLikeMediaType(mediaType: string) {
    const normalizedMediaType = normalizeMediaType(mediaType);

    return (
        normalizedMediaType.startsWith("text/") ||
        normalizedMediaType === "application/javascript" ||
        normalizedMediaType === "application/json" ||
        normalizedMediaType === "application/sql" ||
        normalizedMediaType === "application/toml" ||
        normalizedMediaType === "application/typescript" ||
        normalizedMediaType === "application/xml" ||
        normalizedMediaType === "application/yaml" ||
        normalizedMediaType === "image/svg+xml" ||
        normalizedMediaType.endsWith("+json") ||
        normalizedMediaType.endsWith("+xml")
    );
}

export function extractAiChatAttachmentText(
    part: Pick<FileUIPart, "filename" | "mediaType" | "url">,
) {
    const resolvedMediaType = resolveAiChatAttachmentMediaType(
        part.mediaType,
        part.filename,
    );

    if (!isAiChatTextLikeMediaType(resolvedMediaType)) {
        return null;
    }

    const parsedDataUrl = parseDataUrl(part.url);

    if (!parsedDataUrl) {
        return null;
    }

    try {
        const decodedText = parsedDataUrl.isBase64
            ? decodeBase64ToUtf8(parsedDataUrl.encodedData)
            : decodeURIComponent(parsedDataUrl.encodedData);
        const normalizedText = decodedText.replace(/\0/gu, "").trim();

        return normalizedText || null;
    } catch {
        return null;
    }
}

export function buildAiChatAttachmentPromptText(
    part: Pick<FileUIPart, "filename" | "mediaType" | "url">,
) {
    const resolvedMediaType = resolveAiChatAttachmentMediaType(
        part.mediaType,
        part.filename,
    );
    const attachmentName = part.filename?.trim() || "未命名附件";
    const attachmentText = extractAiChatAttachmentText({
        ...part,
        mediaType: resolvedMediaType,
    });

    if (attachmentText) {
        return [
            "以下是用户附加的文本文件内容：",
            `文件名：${attachmentName}`,
            `媒体类型：${resolvedMediaType}`,
            "",
            truncateAttachmentText(attachmentText),
        ].join("\n");
    }

    if (resolvedMediaType.startsWith("image/")) {
        return `用户附加了一张图片：${attachmentName}（${resolvedMediaType}）。当前对接的 AI 通道不会把图片像素内容发送给模型，请明确说明你无法直接查看图片本身，只能基于文件名和上下文提供帮助。`;
    }

    return `用户附加了一个文件：${attachmentName}（${resolvedMediaType}）。当前对接的 AI 通道不支持直接解析该附件的二进制内容，请结合上下文说明还需要用户补充哪些文本信息。`;
}
