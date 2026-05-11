import { basename, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

/**
 * @description 坎巴拉太空计划支持
 */
async function installCraft(mod: IModInfo, isInstall: boolean) {
    const { gameStorage } = await Manager.getContext();
    const modStorage = await Manager.getModStoragePath(mod.id);

    if (!gameStorage || !modStorage) {
        return false;
    }

    const saves = await FileHandler.getAllFolderInFolder(
        await join(gameStorage, "saves"),
    );

    for (const item of mod.modFiles) {
        if ((await FileHandler.getFileExtension(item)).toLowerCase() !== "craft") {
            continue;
        }

        for (const save of saves) {
            const target = await join(
                save,
                "Ships",
                "VAB",
                await basename(item),
            );
            if (isInstall) {
                await FileHandler.copyFile(
                    await join(modStorage, item),
                    target,
                );
            } else {
                await FileHandler.deleteFile(target);
            }
        }
    }

    return true;
}

export const supportedGames = async () =>
    ({
        GlossGameId: 62,
        steamAppID: 220200,
        curseforge: 4401,
        nexusMods: {
            game_domain_name: "kerbalspaceprogram",
            game_id: 272,
        },
        installdir: await join("Kerbal Space Program"),
        gameName: "Kerbal Space Program",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/220200",
            },
            {
                name: "直接启动",
                exePath: "KSP_x64.exe",
            },
        ],
        gameExe: "KSP_x64.exe",
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/62.jpg",
        modType: [
            {
                id: 1,
                name: "GameData",
                installPath: await join("GameData"),
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath || "",
                        "GameData",
                        true,
                        false,
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath || "",
                        "GameData",
                        false,
                        false,
                        true,
                    );
                },
            },
            {
                id: 2,
                name: "craft",
                installPath: await join("craft"),
                async install(mod) {
                    return installCraft(mod, true);
                },
                async uninstall(mod) {
                    return installCraft(mod, false);
                },
            },
            {
                id: 99,
                name: "未知",
                installPath: "",
                async install(_mod) {
                    ElMessage.warning(
                        "该 Mod 类型未知，无法自动安装，请手动安装。",
                    );
                    return false;
                },
                async uninstall(_mod) {
                    return true;
                },
            },
        ],
        async checkModType(mod) {
            let gameData = false;
            let craft = false;

            for (const item of mod.modFiles) {
                if (item.toLowerCase().includes("gamedata")) gameData = true;
                if ((await FileHandler.getFileExtension(item)).toLowerCase() === "craft")
                    craft = true;
            }

            if (gameData) return 1;
            if (craft) return 2;

            return 99;
        },
    }) as ISupportedGames;
