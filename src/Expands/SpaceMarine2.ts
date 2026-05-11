import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 战锤40K：星际战士2  支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 390,
        steamAppID: 2183900,
        nexusMods: {
            game_domain_name: "warhammer40000spacemarine2",
            game_id: 6771,
        },
        installdir: await join("Space Marine 2"),
        gameName: "Warhammer 40000 Space Marine 2",
        gameExe: "Warhammer 40000 Space Marine 2.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/2183900",
            },
            {
                name: "直接启动",
                exePath: await join("Warhammer 40000 Space Marine 2.exe"),
            },
        ],
        archivePath: await join(
            await FileHandler.GetAppData(),
            "Local",
            "Saber",
            "Space Marine 2",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/mod/202410/MOD6707728ca7d89.webp@webp",
        modType: [
            {
                id: 1,
                name: "pak",
                installPath: await join(
                    "client_pc",
                    "root",
                    "paks",
                    "client",
                    "default",
                ),
                async install(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "pak",
                        true,
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "pak",
                        false,
                        true,
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
            let pak = false;

            for (const item of mod.modFiles) {
                if ((await FileHandler.getFileExtension(item)) == "pak") {
                    pak = true;
                }
            }

            if (pak) return 1;

            return 99;
        },
    }) as ISupportedGames;
