import { join, basename } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 7日杀 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 40,
        steamAppID: 251570,
        nexusMods: {
            game_id: 1059,
            game_domain_name: "7daystodie",
        },
        installdir: await join("7 Days to Die"),
        gameName: "7 Days to Die",
        gameExe: "7DaysToDie.exe",
        archivePath: await join(
            await FileHandler.GetAppData(),
            "Roaming",
            "7DaysToDie",
        ),
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/251570",
            },
            {
                name: "直接启动",
                exePath: await join("7DaysToDie.exe"),
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/40.jpg",
        modType: [
            {
                id: 1,
                name: "Mods",
                installPath: await join("Mods"),
                async install(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "modinfo.xml",
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "modinfo.xml",
                        false,
                    );
                },
            },
            {
                id: 2,
                name: "Avatars",
                installPath: await join("Mods", "VRoidMod", "Avatars"),
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
            let Mods = false;
            let Avatars = false;

            for (const item of mod.modFiles) {
                if ((await basename(item)).toLowerCase() == "modinfo.xml")
                    Mods = true;
                if ((await FileHandler.getFileExtension(item)) == "unity3d") Avatars = true;
            }

            if (Mods) return 1;
            if (Avatars) return 2;

            return 99;
        },
    }) as ISupportedGames;
