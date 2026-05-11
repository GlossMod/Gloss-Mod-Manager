import { join, basename } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 黑神话 悟空 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 291,
        steamAppID: 0,
        gamebanana: 8552,
        nexusMods: {
            game_domain_name: "genshinimpact",
            game_id: 4613,
        },
        installdir: await join("Genshin Impact"),
        gameName: "Genshin Impact",
        startExe: [
            {
                name: "启动Mod",
                exePath: "3DMigoto Loader.exe",
            },
            {
                name: "启动 (国际服)",
                exePath: "GenshinImpact.exe",
            },
            {
                name: "启动 (国服)",
                exePath: "YuanShen.exe",
            },
        ],
        gameExe: [
            {
                name: "GenshinImpact.exe",
                rootPath: ["."],
            },
            {
                name: "YuanShen.exe",
                rootPath: ["."],
            },
        ],
        // archivePath: join(await FileHandler.GetAppData(), "Local", "b1", "Saved"),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/66da7e920f43e.webp",
        modType: [
            {
                id: 1,
                name: "mods",
                installPath: await join("Mods"),
                async install(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "ini",
                        true,
                        true,
                        true,
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "ini",
                        false,
                        true,
                        true,
                        true,
                        true,
                    );
                },
            },
            {
                id: 2,
                name: "GIMI",
                installPath: "",
                async install(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "3DMigoto Loader.exe",
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "3DMigoto Loader.exe",
                        false,
                    );
                },
            },
            {
                id: 99,
                name: "未知",
                installPath: "",
                async install(mod) {
                    void mod;
                    ElMessage.warning(
                        "该mod类型未知, 无法自动安装, 请手动安装!",
                    );
                    return false;
                },
                async uninstall(mod) {
                    void mod;
                    return true;
                },
            },
        ],
        async checkModType(mod) {
            let mods = false;
            let GIMI = false;
            for (const item of mod.modFiles) {
                if ((await FileHandler.getFileExtension(item)) == "ini") mods = true;
                if ((await basename(item)) == "3DMigoto Loader.exe")
                    GIMI = true;
            }

            if (mods) return 1;
            if (GIMI) return 2;

            return 99;
        },
    }) as ISupportedGames;
