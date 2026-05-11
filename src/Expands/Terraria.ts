import { join, basename } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 泰拉瑞亚 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 320,
        steamAppID: 105600,
        // curseforge: 431,
        nexusMods: {
            game_domain_name: "terraria",
            game_id: 549,
        },
        SteamWorkshop: true,
        installdir: await join("Terraria"),
        gameName: "Terraria",
        gameExe: "Terraria.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/105600",
            },
            {
                name: "直接启动",
                exePath: await join("Terraria.exe"),
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "My Games",
            "Terraria",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/64cc631c336ce.webp",
        modType: [
            {
                id: 1,
                name: "pack",
                installPath: await join(
                    await FileHandler.getMyDocuments(),
                    "My Games",
                    "Terraria",
                    "ResourcePacks",
                ),
                async install(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "pack.json",
                        true,
                        false,
                        false,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "pack.json",
                        false,
                        false,
                        false,
                    );
                },
            },
            {
                id: 2,
                name: "tmod",
                installPath: await join(
                    await FileHandler.getMyDocuments(),
                    "My Games",
                    "Terraria",
                    "tModLoader",
                    "Mods",
                ),
                async install(mod) {
                    void mod;
                    // return Manager.installByFolderParent(mod, this.installPath ?? "", "data", true, false)
                    // return Manager.generalInstall(mod, this.installPath ?? "", false, false)
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "workshop.json",
                        true,
                        false,
                        false,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    // return Manager.installByFolderParent(mod, this.installPath ?? "", "data", false, false)
                    // return Manager.generalUninstall(mod, this.installPath ?? "", false, false)
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "workshop.json",
                        false,
                        false,
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
            let pack = false;
            let tmod = false;

            for (const item of mod.modFiles) {
                if ((await basename(item)) == "pack.json") pack = true;
                if ((await FileHandler.getFileExtension(item)) == "tmod") tmod = true;
            }

            if (pack) return 1;
            if (tmod) return 2;

            return 99;
        },
    }) as ISupportedGames;
