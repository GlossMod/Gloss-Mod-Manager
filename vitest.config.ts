import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * 测试环境独立于 vite.config.ts：单元测试不需要 Tauri/自动导入等插件，
 * 这里只保留路径别名，避免插件链干扰测试运行。
 */
export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        environment: "jsdom",
        include: ["src/**/*.test.ts"],
        globals: false,
    },
});
