import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 十字军之王3 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 236,
        steamAppID: 1158310,
        nexusMods: {
            game_domain_name: "crusaderkings3",
            game_id: 3486,
        },
        installdir: await join("Crusader Kings III", "binaries"),
        gameName: "Crusader Kings 3",
        gameExe: "ck3.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1158310",
            },
            {
                name: "直接启动",
                exePath: await join("ck3.exe"),
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "Paradox Interactive",
            "Crusader Kings III",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/236.png",
        modType: [
            {
                id: 1,
                name: "Mods",
                installPath: await join(
                    await FileHandler.getMyDocuments(),
                    "Paradox Interactive",
                    "Crusader Kings III",
                    "mod",
                ),
                async install(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "mod",
                        true,
                        true,
                        false,
                        ["descriptor.mod"],
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "mod",
                        false,
                        true,
                        false,
                        ["descriptor.mod"],
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
