import { describe, expect, it } from "vitest";
import { escapeHtmlText, sanitizeHtml } from "./html-sanitizer";

describe("sanitizeHtml", () => {
    it("移除 script 标签", () => {
        const result = sanitizeHtml('<p>hi</p><script>alert(1)</script>');

        expect(result).toContain("hi");
        expect(result.toLowerCase()).not.toContain("<script");
        expect(result).not.toContain("alert(1)");
    });

    it("移除内联事件处理器", () => {
        const result = sanitizeHtml('<img src="x" onerror="alert(1)">');

        expect(result.toLowerCase()).not.toContain("onerror");
        expect(result).not.toContain("alert(1)");
    });

    it("移除 javascript: 协议链接", () => {
        const result = sanitizeHtml('<a href="javascript:alert(1)">go</a>');

        expect(result.toLowerCase()).not.toContain("javascript:");
    });

    it("移除 iframe 与 object 等可执行容器", () => {
        const result = sanitizeHtml(
            '<iframe src="https://evil.test"></iframe><object data="x"></object>',
        );

        expect(result.toLowerCase()).not.toContain("<iframe");
        expect(result.toLowerCase()).not.toContain("<object");
    });

    it("移除 style 标签与 style 属性", () => {
        const result = sanitizeHtml(
            '<style>body{display:none}</style><p style="position:fixed">x</p>',
        );

        expect(result.toLowerCase()).not.toContain("<style");
        expect(result.toLowerCase()).not.toContain("position:fixed");
    });

    it("移除 svg 命名空间绕过载荷", () => {
        const result = sanitizeHtml(
            '<svg><animate onbegin="alert(1)" attributeName="x"/></svg>',
        );

        expect(result.toLowerCase()).not.toContain("onbegin");
        expect(result).not.toContain("alert(1)");
    });

    it("移除 form 与输入控件，避免伪造交互", () => {
        const result = sanitizeHtml(
            '<form action="https://evil.test"><input name="a"><button>go</button></form>',
        );

        expect(result.toLowerCase()).not.toContain("<form");
        expect(result.toLowerCase()).not.toContain("<input");
    });

    it("保留常规排版标签与安全链接", () => {
        const result = sanitizeHtml(
            '<h2>标题</h2><p><strong>粗体</strong> <a href="https://example.test/a">链接</a></p><ul><li>项</li></ul>',
        );

        expect(result).toContain("<h2>");
        expect(result).toContain("<strong>");
        expect(result).toContain("https://example.test/a");
        expect(result).toContain("<li>");
    });

    it("保留代码块结构与 data-language 属性", () => {
        const result = sanitizeHtml(
            '<pre class="ai-code-block" data-language="ts"><code>const a = 1;</code></pre>',
        );

        expect(result).toContain("data-language=\"ts\"");
        expect(result).toContain("const a = 1;");
    });

    it("保留表格结构", () => {
        const result = sanitizeHtml(
            "<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>b</td></tr></tbody></table>",
        );

        expect(result).toContain("<table>");
        expect(result).toContain("<td>");
    });

    it("为外链补上 target 与 rel，避免反向劫持", () => {
        const result = sanitizeHtml('<a href="https://example.test">x</a>');

        expect(result).toContain('target="_blank"');
        expect(result).toContain("noopener");
        expect(result).toContain("noreferrer");
    });

    it("保留 http/https 图片并允许相对路径", () => {
        const remote = sanitizeHtml('<img src="https://example.test/a.png">');
        const relative = sanitizeHtml('<img src="/imgs/a.png">');

        expect(remote).toContain("https://example.test/a.png");
        expect(relative).toContain("/imgs/a.png");
    });

    it("空输入返回空字符串", () => {
        expect(sanitizeHtml("")).toBe("");
    });

    it("保留纯文本内容", () => {
        expect(sanitizeHtml("纯文本")).toContain("纯文本");
    });
});

describe("escapeHtmlText", () => {
    it("转义 HTML 元字符", () => {
        expect(escapeHtmlText('<a href="x">&\'')).toBe(
            "&lt;a href=&quot;x&quot;&gt;&amp;&#39;",
        );
    });
});
