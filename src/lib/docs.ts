export interface DocRecord {
    path: string;
    routePath: string;
    filePath: string;
    title: string;
    headings: DocHeading[];
    content: string;
}

export interface DocHeading {
    id: string;
    level: number;
    title: string;
}

export interface DocNavGroup {
    title: string;
    links: Array<Pick<DocRecord, "path" | "routePath" | "title">>;
}

const markdownModules = import.meta.glob<string>(
    ["../docs/**/*.md", "!../docs/en/**/*.md"],
    {
        query: "?raw",
        import: "default",
        eager: true,
    },
);

const groupTitles: Record<string, string> = {
    root: "基础文档",
    Use: "游戏教程",
    FQA: "常见问题",
    GMMFile: "GMM 文件",
    Expands: "开发扩展",
};

const groupOrder = ["root", "Use", "FQA", "GMMFile", "Expands"];

const rootOrder = [
    "README",
    "Install",
    "Use",
    "MCP",
    "SupportedGames",
    "Translate",
    "UpdateSource",
    "Feedback",
    "Cooperation",
    "index",
];

const stripWrappingQuotes = (value: string) =>
    value.replace(/^['\"]|['\"]$/g, "").trim();

const normalizeSlashes = (value: string) => value.replace(/\\/g, "/");

const stripMarkdownExtension = (value: string) =>
    value.replace(/\.(md|html)$/i, "");

const removeInlineMarkdown = (value: string) =>
    value
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
        .replace(/[*_~]/g, "")
        .trim();

export const createHeadingSlug = (title: string) =>
    encodeURIComponent(
        removeInlineMarkdown(title)
            .toLowerCase()
            .replace(/<[^>]+>/g, "")
            .replace(/&[a-z#\d]+;/gi, "")
            .replace(/[\s/\\]+/g, "-")
            .replace(/["'.,!?;:()[\]{}]+/g, "")
            .replace(/^-+|-+$/g, ""),
    );

export const createUniqueHeadingSlug = (
    title: string,
    slugCounts: Map<string, number>,
) => {
    const baseSlug = createHeadingSlug(title) || "section";
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);

    return count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
};

const stripFrontmatter = (content: string) => {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

    if (!match) {
        return { body: content, frontmatter: "" };
    }

    return {
        body: content.slice(match[0].length),
        frontmatter: match[1],
    };
};

const extractTitle = (content: string, filePath: string) => {
    const { body, frontmatter } = stripFrontmatter(content);
    const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);

    if (titleMatch?.[1]) {
        return stripWrappingQuotes(titleMatch[1]);
    }

    const headingMatch = body.match(/^#\s+(.+)$/m);

    if (headingMatch?.[1]) {
        return headingMatch[1].replace(/[#`*_]/g, "").trim();
    }

    const pathParts = filePath.split("/");
    return pathParts[pathParts.length - 1].replace(/\.md$/i, "");
};

const extractHeadings = (content: string) => {
    const { body } = stripFrontmatter(content);
    const slugCounts = new Map<string, number>();

    return body
        .split(/\r?\n/)
        .map((line) => line.match(/^(#{2,4})\s+(.+)$/))
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map((match) => {
            const title = removeInlineMarkdown(match[2]);

            return {
                id: createUniqueHeadingSlug(title, slugCounts),
                level: match[1].length,
                title,
            } satisfies DocHeading;
        });
};

const toRoutePath = (docPath: string) => {
    if (docPath === "README") {
        return "/docs";
    }

    if (docPath.endsWith("/README")) {
        return `/docs/${docPath.slice(0, -"/README".length)}`;
    }

    return `/docs/${docPath}`;
};

const getGroupId = (docPath: string) => {
    const pathParts = docPath.split("/");

    if (pathParts.length === 1) {
        return "root";
    }

    return pathParts[0];
};

const getSortIndex = (docPath: string) => {
    if (!docPath.includes("/")) {
        const rootIndex = rootOrder.indexOf(docPath);
        return rootIndex === -1 ? rootOrder.length : rootIndex;
    }

    const fileName = docPath.split("/").at(-1) ?? docPath;
    return fileName === "README" ? -1 : 0;
};

export const docs = Object.entries(markdownModules)
    .map(([modulePath, content]) => {
        const filePath = normalizeSlashes(
            modulePath.replace(/^\.\.\/docs\//, ""),
        );
        const docPath = stripMarkdownExtension(filePath);

        return {
            path: docPath,
            routePath: toRoutePath(docPath),
            filePath,
            title: extractTitle(content, filePath),
            headings: extractHeadings(content),
            content,
        } satisfies DocRecord;
    })
    .sort((firstDoc, secondDoc) => {
        const firstGroup = getGroupId(firstDoc.path);
        const secondGroup = getGroupId(secondDoc.path);
        const groupDelta =
            groupOrder.indexOf(firstGroup) - groupOrder.indexOf(secondGroup);

        if (groupDelta !== 0) {
            return groupDelta;
        }

        const firstSortIndex = getSortIndex(firstDoc.path);
        const secondSortIndex = getSortIndex(secondDoc.path);

        if (firstSortIndex !== secondSortIndex) {
            return firstSortIndex - secondSortIndex;
        }

        return firstDoc.title.localeCompare(secondDoc.title, "zh-Hans-CN");
    });

const docsByLowerPath = new Map(
    docs.map((docRecord) => [docRecord.path.toLowerCase(), docRecord]),
);

export const docsNavGroups = docs.reduce<DocNavGroup[]>((groups, docRecord) => {
    if (docRecord.path === "index" || docRecord.path === "en/index") {
        return groups;
    }

    const groupId = getGroupId(docRecord.path);
    const groupTitle = groupTitles[groupId] ?? groupId;
    let group = groups.find((item) => item.title === groupTitle);

    if (!group) {
        group = { title: groupTitle, links: [] };
        groups.push(group);
    }

    group.links.push({
        path: docRecord.path,
        routePath: docRecord.routePath,
        title: docRecord.title,
    });

    return groups;
}, []);

const normalizeRoutePath = (value: string) =>
    stripMarkdownExtension(
        normalizeSlashes(value)
            .replace(/^\/docs\/?/i, "")
            .replace(/^\//, "")
            .replace(/\/$/, ""),
    );

const getDocCandidates = (routePath: string) => {
    const normalizedPath = normalizeRoutePath(routePath);

    if (!normalizedPath) {
        return ["README", "index"];
    }

    return [
        normalizedPath,
        `${normalizedPath}/README`,
        `${normalizedPath}/index`,
    ];
};

export const resolveDocByPath = (routePath: string) => {
    const candidates = getDocCandidates(routePath);

    for (const candidate of candidates) {
        const docRecord = docsByLowerPath.get(candidate.toLowerCase());

        if (docRecord) {
            return docRecord;
        }
    }

    return undefined;
};

export const resolveDocBySlug = (slug: string | string[] | undefined) => {
    if (!slug) {
        return resolveDocByPath("");
    }

    return resolveDocByPath(Array.isArray(slug) ? slug.join("/") : slug);
};

const splitHashAndQuery = (href: string) => {
    const suffixIndex = href.search(/[?#]/);

    if (suffixIndex === -1) {
        return { hrefPath: href, suffix: "" };
    }

    return {
        hrefPath: href.slice(0, suffixIndex),
        suffix: href.slice(suffixIndex),
    };
};

const normalizeRelativePath = (basePath: string, hrefPath: string) => {
    const baseParts = basePath.split("/").slice(0, -1);
    const hrefParts = hrefPath.split("/");
    const outputParts = hrefPath.startsWith("/") ? [] : [...baseParts];

    for (const part of hrefParts) {
        if (!part || part === ".") {
            continue;
        }

        if (part === "..") {
            outputParts.pop();
            continue;
        }

        outputParts.push(part);
    }

    return outputParts.join("/");
};

export const rewriteDocHref = (href: string, currentDoc: DocRecord) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) {
        return href;
    }

    const { hrefPath, suffix } = splitHashAndQuery(href);
    const normalizedPath = stripMarkdownExtension(
        normalizeRelativePath(currentDoc.path, hrefPath),
    );

    return `${toRoutePath(normalizedPath)}${suffix}`;
};

export const getRenderableMarkdown = (content: string) => {
    const { body } = stripFrontmatter(content);

    return body
        .replace(/^::: code-group\s*$/gm, "")
        .replace(/^:::$/gm, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .trim();
};
