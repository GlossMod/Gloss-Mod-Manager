import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 剑士 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 186,
        steamAppID: 233860,
        nexusMods: {
            game_domain_name: "kenshi",
            game_id: 736,
        },
        installdir: await join("Kenshi"),
        gameName: "Kenshi",
        gameExe: "kenshi_x64.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/233860",
            },
            {
                name: "直接启动",
                exePath: await join("kenshi_x64.exe"),
            },
        ],
        archivePath: await join(
            await FileHandler.GetAppData(),
            "Local",
            "Kenshi",
            "Saved",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/186.png",
        modType: [
            {
                id: 1,
                name: "Mods",
                installPath: await join("mods"),
                async install(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "mod",
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "mod",
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
            let mods = false;

            for (const item of mod.modFiles) {
                if ((await FileHandler.getFileExtension(item)) == "mod") mods = true;
            }

            if (mods) return 1;

            return 99;
        },
    }) as ISupportedGames;
