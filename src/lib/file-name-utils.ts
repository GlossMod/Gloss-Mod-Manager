/**
 * 下载队列相关模块此前各自复制了一份同样的文件名净化逻辑，
 * 这里统一收敛，并补上原实现缺失的上级目录片段处理。
 */

const ILLEGAL_FILE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001F]/gu;
// Windows 保留设备名，作为文件名会导致写入异常。
const RESERVED_WINDOWS_NAMES = new Set([
    "con",
    "prn",
    "aux",
    "nul",
    "com1",
    "com2",
    "com3",
    "com4",
    "com5",
    "com6",
    "com7",
    "com8",
    "com9",
    "lpt1",
    "lpt2",
    "lpt3",
    "lpt4",
    "lpt5",
    "lpt6",
    "lpt7",
    "lpt8",
    "lpt9",
]);

/**
 * 净化下载文件名：移除路径分隔符与非法字符，并避免 . / .. 这类穿越片段。
 */
export function sanitizeFileName(name: string) {
    const sanitized = name.replace(ILLEGAL_FILE_NAME_PATTERN, "-").trim();

    // 原实现会剥离分隔符但保留 ..，单独出现时仍可能被拼接成上级路径。
    if (/^\.+$/u.test(sanitized)) {
        return "";
    }

    // Windows 下结尾的点与空格会被系统忽略，可能绕过扩展名校验。
    const normalized = sanitized.replace(/[. ]+$/u, "");

    if (RESERVED_WINDOWS_NAMES.has(normalized.toLowerCase())) {
        return `_${normalized}`;
    }

    return normalized;
}

/**
 * 从 URL 中解析出安全的文件名，失败时回退默认名。
 */
export function getUrlFileName(url: string, fallback = "download.bin") {
    try {
        const parsedUrl = new URL(url);
        const fileName = decodeURIComponent(
            parsedUrl.pathname.split("/").pop() || fallback,
        );

        return sanitizeFileName(fileName) || fallback;
    } catch {
        return fallback;
    }
}
