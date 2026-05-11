import { basename, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

/**
 * @description 仁王 2 支持
 */
async function installMod(mod: IModInfo, isInstall: boolean) {
    if (isInstall && !Manager.checkInstalled("Nioh 2 Mod Enabler", 204153)) {
        return false;
    }

    const modStorage = await Manager.getModStoragePath(mod.id);
    const { gameStorage } = await Manager.getContext();

    if (!modStorage || !gameStorage) {
        return false;
    }

    const target = await join(gameStorage, "mods", String(mod.id));

    if (isInstall) {
        return FileHandler.createLink(modStorage, target);
    }

    return FileHandler.deleteFolder(target);
}

export const supportedGames = async () =>
    ({
        GlossGameId: 249,
        steamAppID: 1325200,
        nexusMods: {
            game_domain_name: "nioh2",
            game_id: 3660,
        },
        installdir: await join("Nioh2"),
        gameName: "Nioh 2",
        gameExe: "nioh2.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1325200",
            },
            {
                name: "直接启动",
                exePath: "nioh2.exe",
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "KoeiTecmo",
            "Nioh2",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/6041c647d7a35.png",
        modType: [
            {
                id: 1,
                name: "Mod Enabler",
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
                name: "mods",
                installPath: await join("mods"),
                async install(mod) {
                    return installMod(mod, true);
                },
                async uninstall(mod) {
                    return installMod(mod, false);
                },
            },
            {
                id: 3,
                name: "游戏根目录",
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
            let modEnabler = false;
            let mods = false;

            for (const item of mod.modFiles) {
                if ((await basename(item)) === "d3dcompiler_46.dll")
                    modEnabler = true;
                if ((await FileHandler.getFileExtension(item)).toLowerCase() === "ini") mods = true;
            }

            if (modEnabler) return 1;
            if (mods) return 2;

            return 99;
        },
    }) as ISupportedGames;
