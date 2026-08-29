import { describe, expect, it } from "vitest";
import { getUrlFileName, sanitizeFileName } from "./file-name-utils";

describe("sanitizeFileName", () => {
    it("移除路径分隔符，避免写到其他目录", () => {
        expect(sanitizeFileName("a/b\\c.zip")).toBe("a-b-c.zip");
    });

    it("移除 Windows 非法字符", () => {
        expect(sanitizeFileName('a<>:"|?*b.zip')).toBe("a-------b.zip");
    });

    it("移除控制字符", () => {
        expect(sanitizeFileName("a\u0000\u001Fb.zip")).toBe("a--b.zip");
    });

    it("纯点号片段返回空，避免拼出上级路径", () => {
        expect(sanitizeFileName("..")).toBe("");
        expect(sanitizeFileName(".")).toBe("");
        expect(sanitizeFileName("...")).toBe("");
    });

    it("去掉结尾的点与空格", () => {
        expect(sanitizeFileName("mod.zip. ")).toBe("mod.zip");
    });

    it("为 Windows 保留设备名加前缀", () => {
        expect(sanitizeFileName("CON")).toBe("_CON");
        expect(sanitizeFileName("nul")).toBe("_nul");
    });

    it("保留正常文件名", () => {
        expect(sanitizeFileName("Awesome Mod v1.2.zip")).toBe(
            "Awesome Mod v1.2.zip",
        );
    });
});

describe("getUrlFileName", () => {
    it("从 URL 解析文件名", () => {
        expect(getUrlFileName("https://example.test/files/mod.zip")).toBe(
            "mod.zip",
        );
    });

    it("解码百分号编码的文件名", () => {
        expect(getUrlFileName("https://example.test/a/my%20mod.zip")).toBe(
            "my mod.zip",
        );
    });

    it("URL 非法时回退默认名", () => {
        expect(getUrlFileName("not a url")).toBe("download.bin");
    });

    it("路径为空时回退默认名", () => {
        expect(getUrlFileName("https://example.test/")).toBe("download.bin");
    });

    it("对穿越片段回退默认名", () => {
        expect(getUrlFileName("https://example.test/a/..")).toBe(
            "download.bin",
        );
    });
});
