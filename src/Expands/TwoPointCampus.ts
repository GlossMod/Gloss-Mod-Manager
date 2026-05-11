import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 双点学校 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 331,
        steamAppID: 1649080,
        nexusMods: {
            game_domain_name: "twopointcampus",
            game_id: 7479,
        },
        installdir: await join("Two Point Campus"),
        gameName: "Two Point Campus",
        gameExe: "TPC.exe",
        mod_io: 4081,
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1649080",
            },
            {
                name: "直接启动",
                exePath: await join("TPC.exe"),
            },
        ],
        archivePath: await join(
            await FileHandler.GetAppData(),
            "LocalLow",
            "Two Point Studios",
            "Two Point Campus",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/65a74761bb3fe.webp",
        modType: [
            {
                id: 1,
                name: "mods",
                installPath: await join(
                    await FileHandler.GetAppData(),
                    "LocalLow",
                    "Two Point Studios",
                    "Two Point Campus",
                    "Mods",
                ),
                async install(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "json",
                        true,
                        true,
                        false,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "json",
                        false,
                        true,
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
            // // let loader = false
            let mods = false;

            for (const item of mod.modFiles) {
                if ((await FileHandler.getFileExtension(item)) == "json") mods = true;
            }

            if (mods) return 1;

            return 99;
        },
    }) as ISupportedGames;
