import { basename, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";

export const supportedGames = async (): Promise<ISupportedGames> => ({
    GlossGameId: 620,
    steamAppID: 4348910,
    installdir: "Probably Stolen",
    gameName: "Probably Stolen",
    gameExe: "Probably Stolen.exe",
    startExe: [
        {
            name: "Steam 启动",
            cmd: "steam://rungameid/4348910",
        },
        {
            name: "直接启动",
            exePath: "Probably Stolen.exe",
        },
    ],
    gameCoverImg:
        "https://assets-mod.3dmgame.com/static/upload/logo/202611/MODe66d860e86a7b8989c5191a671842735.png",
    modType: [
        {
            id: 1,
            name: "Mods",
            installPath: await join("Mods"),
            async install(mod) {
                return Manager.installByFile(
                    mod,
                    this.installPath,
                    "manifest.xml",
                    true,
                );
            },
            async uninstall(mod) {
                return Manager.installByFile(
                    mod,
                    this.installPath,
                    "manifest.xml",
                    false,
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
        for (const file of mod.modFiles) {
            if ((await basename(file)).toLowerCase() === "manifest.xml") {
                return 1;
            }
        }

        return 99;
    },
});
