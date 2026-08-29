import { detectToolDrift, fingerprintTools, type ToolSet } from "ai";
import { PersistentStore } from "@/lib/persistent-store";

const MCP_TOOL_FINGERPRINT_KEY = "aiChatMcpToolFingerprints";

export type McpToolFingerprintMap = Record<string, string>;

type McpToolFingerprintStore = Record<string, McpToolFingerprintMap>;

export interface IMcpToolDriftResult {
    added: string[];
    removed: string[];
    changed: string[];
}

/**
 * 把工具定义漂移整理成可直接展示的提示文案。
 * 新增工具属于正常扩展，只做告知；变更和移除可能是服务端偷换工具语义（rug pull），需要重点提示。
 */
export function buildMcpToolDriftWarnings(
    drift: IMcpToolDriftResult,
): string[] {
    const warnings: string[] = [];

    if (drift.changed.length > 0) {
        warnings.push(
            `检测到 MCP 工具定义发生变更：${drift.changed.join(", ")}。请确认服务端更新可信后再执行敏感操作。`,
        );
    }

    if (drift.removed.length > 0) {
        warnings.push(`MCP 工具已被移除：${drift.removed.join(", ")}。`);
    }

    if (drift.added.length > 0) {
        warnings.push(`MCP 新增工具：${drift.added.join(", ")}。`);
    }

    return warnings;
}

export function hasMcpToolDrift(drift: IMcpToolDriftResult) {
    return (
        drift.added.length > 0 ||
        drift.removed.length > 0 ||
        drift.changed.length > 0
    );
}

async function readFingerprintStore(): Promise<McpToolFingerprintStore> {
    const saved = await PersistentStore.get<McpToolFingerprintStore>(
        MCP_TOOL_FINGERPRINT_KEY,
        {},
    );

    return saved ?? {};
}

/**
 * 对比当前 MCP 工具定义与上次记录的基线，返回漂移信息并把最新基线写回。
 * 首次连接没有基线，此时只记录不告警。
 */
export async function checkMcpToolDrift(
    serverId: string,
    tools: ToolSet,
): Promise<IMcpToolDriftResult | null> {
    const fingerprints = await fingerprintTools(tools);
    const store = await readFingerprintStore();
    const baseline = store[serverId];

    await PersistentStore.set(MCP_TOOL_FINGERPRINT_KEY, {
        ...store,
        [serverId]: fingerprints,
    });

    if (!baseline) {
        return null;
    }

    const drift = detectToolDrift(fingerprints, baseline);

    return hasMcpToolDrift(drift) ? drift : null;
}
