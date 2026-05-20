export interface IAiChatBundledSkill {
    id: string;
    name: string;
    description: string;
    argumentHint?: string;
    body: string;
    sourcePath: string;
}

// 技能说明需要被打包为内置文本，放在 src 下才能被 Vite 以 raw 方式导入。
const rawSkillModules = import.meta.glob("../skills/**/SKILL.md", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

function unwrapFrontmatterValue(value: string) {
    const trimmedValue = value.trim();

    if (
        (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
        (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
    ) {
        return trimmedValue.slice(1, -1).trim();
    }

    return trimmedValue;
}

function parseSkillFrontmatter(frontmatterText: string) {
    return frontmatterText
        .split(/\r?\n/u)
        .reduce<Record<string, string>>((result, line) => {
            const normalizedLine = line.trim();

            if (!normalizedLine || normalizedLine.startsWith("#")) {
                return result;
            }

            const separatorIndex = normalizedLine.indexOf(":");

            if (separatorIndex <= 0) {
                return result;
            }

            const key = normalizedLine.slice(0, separatorIndex).trim();
            const value = normalizedLine.slice(separatorIndex + 1);

            if (!key) {
                return result;
            }

            result[key] = unwrapFrontmatterValue(value);

            return result;
        }, {});
}

function splitSkillFile(content: string) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u);

    if (!match) {
        return {
            frontmatter: {},
            body: content.trim(),
        };
    }

    return {
        frontmatter: parseSkillFrontmatter(match[1]),
        body: match[2].trim(),
    };
}

function resolveSkillId(modulePath: string) {
    const match = modulePath.match(/skills\/([^/]+)\/SKILL\.md$/u);

    return match?.[1] ?? modulePath;
}

const bundledSkills = Object.entries(rawSkillModules)
    .map(([modulePath, content]) => {
        const { frontmatter, body } = splitSkillFile(content);
        const id = resolveSkillId(modulePath);
        const name = frontmatter.name?.trim() || id;
        const description = frontmatter.description?.trim() || "";

        return {
            id,
            name,
            description,
            argumentHint: frontmatter["argument-hint"]?.trim() || undefined,
            body,
            sourcePath: `src/skills/${id}/SKILL.md`,
        } satisfies IAiChatBundledSkill;
    })
    .sort((left, right) => {
        return left.name.localeCompare(right.name, "zh-CN");
    });

export function getBundledAiChatSkills() {
    return bundledSkills;
}

export function buildBundledAiChatSkillsPrompt() {
    if (bundledSkills.length === 0) {
        return "";
    }

    const skillSummaryText = bundledSkills
        .map((skill) => {
            return `- ${skill.name}: ${skill.description || "未提供描述"}`;
        })
        .join("\n");

    const skillDetailText = bundledSkills
        .map((skill) => {
            return [
                `### ${skill.name}`,
                `来源：${skill.sourcePath}`,
                `适用场景：${skill.description || "未提供描述"}`,
                skill.argumentHint
                    ? `参数提示：${skill.argumentHint}`
                    : undefined,
                skill.body,
            ]
                .filter(Boolean)
                .join("\n\n");
        })
        .join("\n\n");

    return [
        "以下内置 skills 已自动加载到当前会话。",
        "只要用户需求与某个 skill 匹配，就直接采用对应 workflow，不需要等待用户显式点名。",
        "如果多个 skill 同时相关，优先选择最贴近当前任务的 skill，并仅在必要时组合使用。",
        `可用 skills：\n${skillSummaryText}`,
        "以下是每个 skill 的完整说明：",
        skillDetailText,
    ].join("\n\n");
}
