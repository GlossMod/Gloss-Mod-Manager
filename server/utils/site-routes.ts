import fs from "node:fs";
import path from "node:path";

const staticRoutes = ["/", "/download", "/games", "/add-new-game", "/docs"];

const toDocRoute = (relativeFilePath: string) => {
    const docPath = relativeFilePath.replace(/\\/g, "/").replace(/\.md$/i, "");

    if (docPath === "README") {
        return "/docs";
    }

    if (docPath === "index") {
        return undefined;
    }

    if (docPath.endsWith("/README")) {
        return `/docs/${docPath.slice(0, -"/README".length)}`;
    }

    return `/docs/${docPath}`;
};

const collectMarkdownRoutes = (
    directory: string,
    rootDirectory = directory,
): string[] => {
    if (!fs.existsSync(directory)) {
        return [];
    }

    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry): string[] => {
            const entryPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                if (entry.name.toLowerCase() === "en") {
                    return [];
                }

                return collectMarkdownRoutes(entryPath, rootDirectory);
            }

            if (!entry.isFile() || !entry.name.endsWith(".md")) {
                return [];
            }

            const relativeFilePath = path.relative(rootDirectory, entryPath);
            const route = toDocRoute(relativeFilePath);

            return route ? [route] : [];
        });
};

export const getSiteRoutes = () => {
    const docsDirectory = path.resolve(process.cwd(), "src/docs");

    return Array.from(
        new Set([...staticRoutes, ...collectMarkdownRoutes(docsDirectory)]),
    ).sort((firstRoute, secondRoute) =>
        firstRoute.localeCompare(secondRoute, "zh-Hans-CN"),
    );
};

export const getRoutePriority = (route: string) => {
    if (route === "/") {
        return "1.0";
    }

    if (["/download", "/games", "/add-new-game", "/docs"].includes(route)) {
        return "0.9";
    }

    return "0.7";
};

export const escapeXml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
