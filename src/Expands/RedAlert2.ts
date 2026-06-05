import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";
import { join } from "@tauri-apps/api/path";

/**
 * @description 命令与征服：红色警戒 2 及尤里的复仇 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 521,
        steamAppID: 2229850,
        gamebanana: 1599,
        nexusMods: {
            game_id: 1455,
            game_domain_name: "commandandconquerredalert2",
        },
        installdir: await join("Command and Conquer Red Alert II"),
        gameName: "Command & Conquer Red Alert 2 and Yuri's Revenge",
        gameExe: "game.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/2229850",
            },
            {
                name: "直接启动红色警戒2",
                exePath: "game.exe",
            },
            {
                name: "直接启动尤里的复仇",
                exePath: "gamemd.exe",
            },
            {
                name: "配置ddraw",
                exePath: "cnc-ddraw config.exe",
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/logo/croppedImg_6a2242d3d562a.png",
        modType: [
            {
                id: 1,
                name: "游戏根目录",
                installPath: "",
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
            let Root = false;

            if ((await FileHandler.getFileExtension(mod.fileName)) == "zip") Root = true;
            if ((await FileHandler.getFileExtension(mod.fileName)) == "rar") Root = true;
            if ((await FileHandler.getFileExtension(mod.fileName)) == "7z") Root = true;

            if (Root) return 1;

            return 99;
        },
    }) as ISupportedGames;
