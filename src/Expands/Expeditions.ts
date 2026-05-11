import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 远征：泥泞奔驰游戏 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 356,
        steamAppID: 2477340,
        mod_io: 5734,
        nexusMods: {
            game_domain_name: "expeditionsamudrunnergame",
            game_id: 6257,
        },
        installdir: await join(
            "Expeditions A MudRunner Game",
            "Sources",
            "Bin",
        ),
        gameName: "Expeditions A MudRunner Game",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/2477340",
            },
            {
                name: "直接启动",
                exePath: await join("Sources", "Bin", "Expeditions.exe"),
            },
        ],
        gameExe: [
            {
                name: "Expeditions.exe",
                rootPath: ["..", ".."],
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/6670007e442e8.webp",
        modType: [
            {
                id: 1,
                name: "pak",
                installPath: await join("preload", "paks", "client"),
                async install(mod) {
                    void mod;
                    return Manager.generalInstall(
                        mod,
                        this.installPath ?? "",
                        false,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.generalUninstall(
                        mod,
                        this.installPath ?? "",
                        false,
                    );
                },
            },
            {
                id: 99,
                name: "未知",
                installPath: "\\",
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
            let pak = false;

            for (const item of mod.modFiles) {
                if ((await FileHandler.getFileExtension(item)) == "pak") pak = true;
            }

            if (pak) return 1;

            return 99;
        },
    }) as ISupportedGames;
