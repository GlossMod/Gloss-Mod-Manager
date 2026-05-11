import { join, basename } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 美国末日2 支持
 */

// console.log(settings.settings.managerGame);
export const supportedGames = async () =>
    ({
        GlossGameId: 429,
        steamAppID: 2531310,
        nexusMods: {
            game_domain_name: "thelastofuspart2",
            game_id: 7521,
        },
        installdir: "The Last of Us Part II",
        gameName: "The Last of Us Part 2",
        gameExe: "tlou-ii.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/2531310",
            },
            {
                name: "直接启动",
                exePath: "tlou-ii.exe",
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/logo/croppedImg_67fdc9247cc4b.jpg",
        modType: [
            {
                id: 1,
                name: "modloader",
                // installPath: '\\left4dead2\\addons',
                installPath: "",
                async install(mod) {
                    void mod;
                    return Manager.generalInstall(
                        mod,
                        this.installPath ?? "",
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.generalUninstall(
                        mod,
                        this.installPath ?? "",
                        true,
                    );
                },
            },
            {
                id: 2,
                name: "mods",
                installPath: await join("mods"),
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
            let modloader = false;
            let mods = false;

            for (const item of mod.modFiles) {
                if ((await basename(item)) == "winmm.dll") modloader = true;
                if ((await FileHandler.getFileExtension(item)) == "psarc") mods = true;
            }

            if (modloader) return 1;
            if (mods) return 2;

            return 99;
        },
    }) as ISupportedGames;
