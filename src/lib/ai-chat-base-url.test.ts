import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface IProviderOptions {
    baseURL?: string;
}

const createOpenAICompatibleMock = vi.fn((_options: IProviderOptions) => ({
    chatModel: vi.fn((modelId: string) => ({ modelId })),
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
    createOpenAICompatible: (options: IProviderOptions) =>
        createOpenAICompatibleMock(options),
}));

vi.mock("@ai-sdk/mcp", () => ({
    createMCPClient: vi.fn(),
}));

vi.mock("ai", () => ({
    isStepCount: vi.fn(),
    pruneMessages: vi.fn(),
    tool: vi.fn(),
    ToolLoopAgent: class {},
}));

vi.mock("@/lib/ai-chat-skills", () => ({
    buildBundledAiChatSkillsPrompt: vi.fn(() => ""),
}));

vi.mock("@/lib/mcp-tool-drift", () => ({
    buildMcpToolDriftWarnings: vi.fn(() => []),
    checkMcpToolDrift: vi.fn(),
}));

vi.mock("@/lib/mcp-service", () => ({
    McpService: { authToken: { value: "" }, endpoint: { value: "" } },
}));

vi.mock("@/lib/secret-store", () => ({
    SecretStore: { getSafe: vi.fn(async () => "") },
}));

vi.mock("@/stores/manager", () => ({
    useManager: vi.fn(),
}));

const { AiChat } = await import("./AiChat");

const fetchMock = vi.fn();

beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    fetchMock.mockReset();
    createOpenAICompatibleMock.mockClear();
    vi.unstubAllGlobals();
});

function modelListResponse(status: number, ids: string[] = []) {
    return new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function getProviderBaseUrl() {
    const calls = createOpenAICompatibleMock.mock.calls;

    return calls[calls.length - 1]?.[0]?.baseURL;
}

describe("AiChat provider base URL 解析", () => {
    it("根地址在 /models 404 后回落到 /v1，provider 用解析后的地址", async () => {
        fetchMock
            .mockResolvedValueOnce(modelListResponse(404))
            .mockResolvedValueOnce(modelListResponse(200, ["gpt-test"]));

        const service = new AiChat("https://api.example.test", "key");
        const models = await service.getModels();

        expect(models.map((model) => model.id)).toEqual(["gpt-test"]);

        service.Agent.chatModel("gpt-test");

        expect(getProviderBaseUrl()).toBe("https://api.example.test/v1");
    });

    it("ensureProviderBaseUrl 会在未取模型列表时主动探测", async () => {
        fetchMock
            .mockResolvedValueOnce(modelListResponse(404))
            .mockResolvedValueOnce(modelListResponse(200, ["gpt-test"]));

        const service = new AiChat("https://api.example.test", "key");

        await service.ensureProviderBaseUrl();
        service.Agent.chatModel("gpt-test");

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(getProviderBaseUrl()).toBe("https://api.example.test/v1");
    });

    it("地址已含 /v1 时不需要额外探测", async () => {
        const service = new AiChat("https://api.example.test/v1", "key");

        await service.ensureProviderBaseUrl();
        service.Agent.chatModel("gpt-test");

        expect(fetchMock).not.toHaveBeenCalled();
        expect(getProviderBaseUrl()).toBe("https://api.example.test/v1");
    });
});
