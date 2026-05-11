import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 无双大蛇4 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 168,
        steamAppID: 831560,
        nexusMods: {
            game_domain_name: "warriorsorochi4",
            game_id: 2624,
        },
        installdir: await join("WARRIORS OROCHI 4"),
        gameName: "Warriors Orochi 4",
        gameExe: "WO4.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/831560",
            },
            {
                name: "直接启动",
                exePath: await join("WO4.exe"),
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/168.jpg",
        modType: [
            {
                id: 1,
                name: "bin",
                installPath: await join("tmp", "dlc"),
                async install(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "bin",
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "bin",
                        false,
                        true,
                    );
                },
            },
            {
                id: 99,
                name: "未知",
                installPath: "",
                async install(mod) {
                    void mod;
                    ElMessage.warning("未知类型, 请手动安装");
                    return false;
                },
                async uninstall(mod) {
                    void mod;
                    return true;
                },
            },
        ],
        async checkModType(mod) {
            let bin = false;

            for (const item of mod.modFiles) {
                if ((await FileHandler.getFileExtension(item)) == "bin") bin = true;
            }

            if (bin) return 1;

            return 99;
        },
    }) as ISupportedGames;
