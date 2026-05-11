import { basename, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

/**
 * @description 神界：原罪 2 支持
 */
async function handlePakMod(mod: IModInfo, isInstall: boolean) {
    const modStorage = await Manager.getModStoragePath(mod.id);
    const installPath = await join(
        await FileHandler.getMyDocuments(),
        "Larian Studios",
        "Divinity Original Sin 2 Definitive Edition",
        "Mods",
    );

    if (!modStorage) {
        return false;
    }

    for (const item of mod.modFiles) {
        if ((await FileHandler.getFileExtension(item)).toLowerCase() !== "pak") {
            continue;
        }

        const target = await join(installPath, await basename(item));

        if (isInstall) {
            await FileHandler.copyFile(await join(modStorage, item), target);
        } else {
            await FileHandler.deleteFile(target);
        }
    }

    return true;
}

export const supportedGames = async () =>
    ({
        GlossGameId: 34,
        steamAppID: 435150,
        nexusMods: {
            game_domain_name: "divinityoriginalsin2",
            game_id: 1661,
        },
        installdir: await join("Divinity Original Sin 2", "DefEd", "bin"),
        gameName: "Divinity Original Sin 2",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/435150",
            },
            {
                name: "直接启动",
                exePath: await join("DefEd", "bin", "EoCApp.exe"),
            },
        ],
        gameExe: [
            {
                name: "EoCApp.exe",
                rootPath: ["..", ".."],
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "Larian Studios",
            "Divinity Original Sin 2 Definitive Edition",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/34.jpg",
        modType: [
            {
                id: 1,
                name: "pak",
                installPath: await join("mods"),
                async install(mod) {
                    return handlePakMod(mod, true);
                },
                async uninstall(mod) {
                    return handlePakMod(mod, false);
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
            for (const item of mod.modFiles) {
                if ((await FileHandler.getFileExtension(item)).toLowerCase() === "pak") {
                    return 1;
                }
            }

            return 99;
        },
    }) as ISupportedGames;
