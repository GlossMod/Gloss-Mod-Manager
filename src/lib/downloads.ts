import { computed, onMounted, ref } from "vue";

export const RELEASE_API_URL =
    "https://api.github.com/repos/GlossMod/Gloss-Mod-Manager/releases/latest";
export const RELEASE_PAGE_URL =
    "https://github.com/GlossMod/Gloss-Mod-Manager/releases";

export type PlatformKey = "windows" | "macos" | "linux";
export type DetectedPlatformKey = PlatformKey | "unknown";

export interface GithubReleaseAsset {
    id: number;
    name: string;
    size?: number;
    download_count?: number;
    browser_download_url: string;
}

interface GithubReleaseResponse {
    tag_name?: string;
    assets?: GithubReleaseAsset[];
}

export interface DownloadItem {
    id: number;
    name: string;
    platform: PlatformKey;
    format: string;
    label: string;
    detail: string;
    arch: string;
    size?: number;
    downloadCount?: number;
    downloadUrl: string;
    primary: boolean;
}

export const platformLabels: Record<DetectedPlatformKey, string> = {
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    unknown: "当前系统",
};

const platformOrder: PlatformKey[] = ["windows", "linux", "macos"];

const priorityMap: Record<PlatformKey, string[]> = {
    windows: ["Setup", "MSI"],
    linux: ["AppImage", "DEB", "RPM"],
    macos: ["DMG", "TAR.GZ"],
};

function getPlatformByName(name: string): PlatformKey | null {
    const normalizedName = name.toLowerCase();

    if (normalizedName.endsWith(".exe") || normalizedName.endsWith(".msi")) {
        return "windows";
    }

    if (
        normalizedName.endsWith(".dmg") ||
        normalizedName.endsWith(".app.tar.gz")
    ) {
        return "macos";
    }

    if (
        normalizedName.endsWith(".appimage") ||
        normalizedName.endsWith(".deb") ||
        normalizedName.endsWith(".rpm")
    ) {
        return "linux";
    }

    return null;
}

function getFormatByName(name: string): string {
    const normalizedName = name.toLowerCase();

    if (normalizedName.endsWith("-setup.exe")) {
        return "Setup";
    }

    if (normalizedName.endsWith(".msi")) {
        return "MSI";
    }

    if (normalizedName.endsWith(".dmg")) {
        return "DMG";
    }

    if (normalizedName.endsWith(".appimage")) {
        return "AppImage";
    }

    if (normalizedName.endsWith(".deb")) {
        return "DEB";
    }

    if (normalizedName.endsWith(".rpm")) {
        return "RPM";
    }

    if (normalizedName.endsWith(".app.tar.gz")) {
        return "TAR.GZ";
    }

    return "Package";
}

function getArchByName(name: string): string {
    const normalizedName = name.toLowerCase();

    if (/aarch64|arm64/.test(normalizedName)) {
        return "Arm64";
    }

    if (/x86_64|amd64|x64/.test(normalizedName)) {
        return "x64";
    }

    if (normalizedName.includes("universal")) {
        return "Universal";
    }

    return "通用";
}

function getDownloadMeta(platform: PlatformKey, format: string) {
    if (platform === "windows" && format === "Setup") {
        return {
            label: "Windows 安装器",
            detail: "Windows 10 / 11",
            primary: true,
        };
    }

    if (platform === "windows" && format === "MSI") {
        return {
            label: "Windows MSI",
            detail: "企业部署安装包",
            primary: false,
        };
    }

    if (platform === "macos" && format === "DMG") {
        return {
            label: "macOS DMG",
            detail: "macOS 12+ / Apple Silicon",
            primary: true,
        };
    }

    if (platform === "macos") {
        return {
            label: "macOS App 归档",
            detail: "独立 App 包",
            primary: false,
        };
    }

    if (format === "AppImage") {
        return {
            label: "Linux AppImage",
            detail: "通用 Linux 桌面版",
            primary: true,
        };
    }

    if (format === "DEB") {
        return {
            label: "Debian / Ubuntu",
            detail: "Debian、Ubuntu",
            primary: false,
        };
    }

    if (format === "RPM") {
        return {
            label: "Red Hat / Fedora",
            detail: "Red Hat、Fedora、SUSE",
            primary: false,
        };
    }

    return {
        label: `${platformLabels[platform]} 安装包`,
        detail: "桌面版安装包",
        primary: false,
    };
}

function isDownloadAsset(asset: GithubReleaseAsset): boolean {
    const normalizedName = asset.name.toLowerCase();

    return !normalizedName.endsWith(".sig") && normalizedName !== "latest.json";
}

function sortDownloadItems(items: DownloadItem[]) {
    return [...items].sort((firstItem, secondItem) => {
        const platformDiff =
            platformOrder.indexOf(firstItem.platform) -
            platformOrder.indexOf(secondItem.platform);

        if (platformDiff !== 0) {
            return platformDiff;
        }

        return (
            priorityMap[firstItem.platform].indexOf(firstItem.format) -
            priorityMap[secondItem.platform].indexOf(secondItem.format)
        );
    });
}

export function parseReleaseAssets(assets: GithubReleaseAsset[] = []) {
    const downloads = assets.reduce<DownloadItem[]>((items, asset) => {
        if (!isDownloadAsset(asset)) {
            return items;
        }

        const platform = getPlatformByName(asset.name);

        if (!platform) {
            return items;
        }

        const format = getFormatByName(asset.name);
        const meta = getDownloadMeta(platform, format);

        items.push({
            id: asset.id,
            name: asset.name,
            platform,
            format,
            label: meta.label,
            detail: meta.detail,
            arch: getArchByName(asset.name),
            size: asset.size,
            downloadCount: asset.download_count,
            downloadUrl: asset.browser_download_url,
            primary: meta.primary,
        });

        return items;
    }, []);

    return sortDownloadItems(downloads);
}

export function groupDownloadsByPlatform(items: DownloadItem[]) {
    return items.reduce<Record<PlatformKey, DownloadItem[]>>(
        (groups, item) => {
            groups[item.platform].push(item);
            return groups;
        },
        {
            windows: [],
            linux: [],
            macos: [],
        },
    );
}

export function detectPlatform(): DetectedPlatformKey {
    if (typeof navigator === "undefined") {
        return "unknown";
    }

    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    const signal = `${platform} ${userAgent}`;

    if (signal.includes("win")) {
        return "windows";
    }

    if (signal.includes("mac")) {
        return "macos";
    }

    if (signal.includes("linux") || signal.includes("x11")) {
        return "linux";
    }

    return "unknown";
}

export function getPreferredDownload(
    items: DownloadItem[],
    platform: DetectedPlatformKey,
) {
    if (platform === "unknown") {
        return null;
    }

    const currentPlatformItems = groupDownloadsByPlatform(items)[platform];

    return (
        currentPlatformItems.find((item) => item.primary) ??
        currentPlatformItems[0] ??
        null
    );
}

export function formatFileSize(size?: number) {
    if (!size) {
        return "";
    }

    const sizeInMb = size / 1024 / 1024;

    return `${sizeInMb.toFixed(sizeInMb >= 10 ? 0 : 1)} MB`;
}

export function useLatestReleaseDownloads() {
    const latestVersion = ref("v2.0.6");
    const downloads = ref<DownloadItem[]>([]);
    const detectedPlatform = ref<DetectedPlatformKey>(detectPlatform());
    const isReleaseLoading = ref(true);
    const releaseError = ref("");

    const preferredDownload = computed(() =>
        getPreferredDownload(downloads.value, detectedPlatform.value),
    );

    async function getLatestVersion() {
        isReleaseLoading.value = true;
        releaseError.value = "";

        try {
            const res = await fetch(RELEASE_API_URL, {
                headers: {
                    Authorization: `token ${import.meta.env.VITE_GITHUB_KEY}`,
                },
            });

            if (!res.ok) {
                throw new Error("获取 GitHub Releases 失败");
            }

            const data = (await res.json()) as GithubReleaseResponse;

            latestVersion.value = data.tag_name ?? latestVersion.value;
            downloads.value = parseReleaseAssets(data.assets ?? []);
        } catch (error) {
            releaseError.value =
                "暂时无法获取 GitHub 最新版本，请前往 Releases 查看。";
        } finally {
            isReleaseLoading.value = false;
        }
    }

    onMounted(getLatestVersion);

    return {
        latestVersion,
        downloads,
        detectedPlatform,
        isReleaseLoading,
        releaseError,
        preferredDownload,
    };
}
