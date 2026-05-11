import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 对马岛之鬼 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 351,
        steamAppID: 2215430,
        nexusMods: {
            game_domain_name: "ghostoftsushima",
            game_id: 6434,
        },
        installdir: await join("Ghost of Tsushima DIRECTOR'S CUT"),
        gameName: "Ghost of Tsushima",
        gameExe: "GhostOfTsushima.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/2215430",
            },
            {
                name: "直接启动",
                exePath: "GhostOfTsushima.exe",
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "Ghost of Tsushima DIRECTOR'S CUT",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/664703cf381cf.webp",
        modType: [
            {
                id: 1,
                name: "psarc",
                installPath: await join("cache_pc", "psarc"),
                async install(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "psarc",
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "psarc",
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
            let psarc = false;

            for (const item of mod.modFiles) {
                if ((await FileHandler.getFileExtension(item)) == "psarc") psarc = true;
            }

            if (psarc) return 1;

            return 99;
        },
    }) as ISupportedGames;
