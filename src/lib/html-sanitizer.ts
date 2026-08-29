import DOMPurify from "dompurify";
import type { Config } from "dompurify";

/**
 * mod 简介、AI 回复等富文本都来自不可信来源（第三方平台接口、模型输出），
 * 而应用运行在拥有文件系统与 shell 能力的 webview 中，一旦注入脚本即可越权，
 * 因此所有进入 v-html 的内容必须先经过这里统一净化。
 */

const ALLOWED_TAGS: string[] = [
    "a",
    "b",
    "blockquote",
    "br",
    "caption",
    "code",
    "col",
    "colgroup",
    "dd",
    "del",
    "details",
    "div",
    "dl",
    "dt",
    "em",
    "figcaption",
    "figure",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "ins",
    "kbd",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "samp",
    "section",
    "small",
    "span",
    "strong",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
    "video",
    "source",
];

const ALLOWED_ATTRIBUTES: string[] = [
    "align",
    "alt",
    "class",
    "colspan",
    "controls",
    "data-language",
    "dir",
    "height",
    "href",
    "id",
    "lang",
    "loading",
    "name",
    "poster",
    "rel",
    "rowspan",
    "span",
    "src",
    "start",
    "target",
    "title",
    "type",
    "width",
];

const SANITIZE_CONFIG: Config = {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
    // 禁止 data: 与 javascript: 等可执行来源，只放行常规网络与本地资源协议。
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel|asset|blob):|^[./#]/iu,
    FORBID_TAGS: [
        "script",
        "style",
        "iframe",
        "object",
        "embed",
        "form",
        "input",
        "button",
        "textarea",
        "select",
        "link",
        "meta",
        "base",
        "svg",
        "math",
    ],
    FORBID_ATTR: ["style", "srcset", "formaction", "background"],
    // 限定为 HTML 配置，避免 SVG/MathML 命名空间混淆类绕过载荷。
    USE_PROFILES: { html: true },
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
};

let hooksInstalled = false;

function installHooks() {
    if (hooksInstalled) {
        return;
    }

    hooksInstalled = true;

    // DOMPurify 已移除 on* 属性，这里额外收敛外链行为，避免 target=_blank 反向劫持。
    DOMPurify.addHook("afterSanitizeAttributes", (node: Element) => {
        if (node.tagName === "A" && node.hasAttribute("href")) {
            node.setAttribute("target", "_blank");
            node.setAttribute("rel", "noopener noreferrer nofollow");
        }

        if (node.tagName === "IMG") {
            node.setAttribute("loading", "lazy");
        }
    });
}

/**
 * 净化不可信 HTML 片段，返回可安全交给 v-html 的字符串。
 */
export function sanitizeHtml(source: string): string {
    if (!source) {
        return "";
    }

    installHooks();

    return DOMPurify.sanitize(source, SANITIZE_CONFIG) as string;
}

/**
 * 将纯文本转义为 HTML 实体，供代码块等需要保留原样的场景使用。
 */
export function escapeHtmlText(source: string): string {
    return source
        .replace(/&/gu, "&amp;")
        .replace(/</gu, "&lt;")
        .replace(/>/gu, "&gt;")
        .replace(/"/gu, "&quot;")
        .replace(/'/gu, "&#39;");
}
