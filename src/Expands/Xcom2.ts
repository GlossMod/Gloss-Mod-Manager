import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 幽浮 2 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 38,
        steamAppID: 268500,
        installdir: await join("XCOM 2", "Binaries", "Win64"),
        gameName: "XCOM2",
        gameExe: [
            {
                name: "XCom2.exe",
                rootPath: ["..", ".."],
            },
        ],
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/268500",
            },
            {
                name: "直接启动",
                exePath: await join("Binaries", "Win64", "XCom2.exe"),
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/38.jpg",
        modType: [
            {
                id: 1,
                name: "通用类型",
                installPath: await join("Mods"),
                async install(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        ".XComMod",
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        ".XComMod",
                        false,
                        true,
                    );
                },
            },
            {
                id: 99,
                name: "未知",
                installPath: "",
                async install(_mod) {
                    ElMessage.warning("未知类型，请手动安装");
                    return false;
                },
                async uninstall(_mod) {
                    return true;
                },
            },
        ],
        async checkModType(mod) {
            for (const item of mod.modFiles) {
                if ((await FileHandler.getFileExtension(item)).toLowerCase() === "xcommod") {
                    return 1;
                }
            }

            return 99;
        },
    }) as ISupportedGames;
