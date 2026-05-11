import { basename, dirname, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

const folderList = ["archive", "bin", "engine", "r6", "red4ext", "mods"];

/**
 * @description 赛博朋克 2077 支持
 */
async function handlePlugins(
    mod: IModInfo,
    installPath: string,
    isInstall: boolean,
) {
    const modStorage = await Manager.getModStoragePath(mod.id);
    const { gameStorage } = await Manager.getContext();

    if (!modStorage || !gameStorage) {
        return false;
    }

    const files: string[] = [];
    for (const item of mod.modFiles) {
        const filePath = await join(modStorage, item);
        if (await FileHandler.isFile(filePath)) {
            files.push(filePath);
        }
    }

    if (files.length === 0) {
        return false;
    }

    let folder = FileHandler.getCommonParentFolder(files);
    if (files.length === 1) {
        folder = await dirname(files[0]);
    }

    const target = await join(gameStorage, installPath, await basename(folder));
    return isInstall
        ? FileHandler.copyFolder(folder, target)
        : FileHandler.deleteFolder(target);
}

export const supportedGames = async () =>
    ({
        GlossGameId: 195,
        steamAppID: 1091500,
        nexusMods: {
            game_domain_name: "cyberpunk2077",
            game_id: 3333,
        },
        installdir: await join("Cyberpunk 2077", "bin", "x64"),
        gameName: "Cyberpunk 2077",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1091500",
            },
            {
                name: "直接启动",
                exePath: await join("bin", "x64", "Cyberpunk2077.exe"),
            },
        ],
        gameExe: [
            {
                name: "Cyberpunk2077.exe",
                rootPath: ["..", ".."],
            },
            {
                name: "REDprelauncher.exe",
                rootPath: ["."],
            },
        ],
        archivePath: await join(
            await FileHandler.GetAppData(),
            "..",
            "Saved Games",
            "CD Projekt Red",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/195.png",
        modType: [
            {
                id: 1,
                name: "CET",
                installPath: "",
                async install(mod) {
                    return Manager.generalInstall(
                        mod,
                        this.installPath ?? "",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.generalUninstall(
                        mod,
                        this.installPath ?? "",
                        true,
                    );
                },
            },
            {
                id: 2,
                name: "archive",
                installPath: await join("archive", "pc", "mod"),
                async install(mod) {
                    return Manager.generalInstall(mod, this.installPath ?? "");
                },
                async uninstall(mod) {
                    return Manager.generalUninstall(
                        mod,
                        this.installPath ?? "",
                    );
                },
            },
            {
                id: 3,
                name: "脚本",
                installPath: await join(
                    "bin",
                    "x64",
                    "plugins",
                    "cyber_engine_tweaks",
                    "mods",
                ),
                async install(mod) {
                    return handlePlugins(mod, this.installPath ?? "", true);
                },
                async uninstall(mod) {
                    return handlePlugins(mod, this.installPath ?? "", false);
                },
            },
            {
                id: 4,
                name: "主目录",
                installPath: "",
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        folderList,
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        folderList,
                        false,
                        true,
                    );
                },
            },
            {
                id: 5,
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
            let cet = false;
            let archive = false;
            let lua = false;
            let mainFolder = false;

            for (const item of mod.modFiles) {
                const pathParts = FileHandler.pathToArray(item);
                if (pathParts.some((part) => folderList.includes(part))) {
                    mainFolder = true;
                }

                const extension = await FileHandler.getFileExtension(item);
                if (extension === "archive") archive = true;
                if (extension === "lua") lua = true;
                if ((await basename(item)) === "cyber_engine_tweaks.asi")
                    cet = true;
            }

            if (cet) return 1;
            if (mainFolder) return 4;
            if (archive) return 2;
            if (lua) return 3;
            return 5;
        },
    }) as ISupportedGames;
