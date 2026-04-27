import path from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import VueRouter from "vue-router/vite";
import Components from "unplugin-vue-components/vite";

export default defineConfig({
    plugins: [
        vue(),
        tailwindcss(),
        AutoImport({
            imports: ["vue", "vue-router", "@vueuse/core"],
            dts: "src/auto-imports.d.ts",
            dirs: ["src/lib"],
        }),
        VueRouter({
            // Recommended: auto-included by tsconfig
            dts: "src/typed-router.d.ts",
        }),
        Components({
            dirs: ["src/components/ui", "src/components"],
            resolvers: [
                (name) => {
                    if (name.startsWith("Icon")) {
                        return {
                            name: name.slice(4),
                            from: "lucide-vue-next",
                        };
                    }
                },
            ],
            dts: "src/components.d.ts",
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
