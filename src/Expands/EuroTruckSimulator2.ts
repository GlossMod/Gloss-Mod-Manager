import { basename, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

/**
 * @description 欧洲卡车模拟器 2 支持
 */
async function handleMod(
    mod: IModInfo,
    installPath: string,
    isInstall: boolean,
) {
    const modStorage = await Manager.getModStoragePath(mod.id);

    if (!modStorage) {
        return false;
    }

    for (const item of mod.modFiles) {
        if ((await FileHandler.getFileExtension(item)).toLowerCase() !== "scs") {
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
        GlossGameId: 15,
        steamAppID: 227300,
        nexusMods: {
            game_domain_name: "eurotrucksimulator2",
            game_id: 328,
        },
        installdir: await join("Euro Truck Simulator 2", "bin", "win_x64"),
        gameName: "Euro Truck Simulator 2",
        gameExe: [
            {
                name: "eurotrucks2.exe",
                rootPath: ["..", ".."],
            },
        ],
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/227300",
            },
            {
                name: "直接启动",
                exePath: await join("bin", "win_x64", "eurotrucks2.exe"),
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "Euro Truck Simulator 2",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/15.jpg",
        modType: [
            {
                id: 1,
                name: "scs",
                installPath: await join(
                    await FileHandler.getMyDocuments(),
                    "Euro Truck Simulator 2",
                    "mod",
                ),
                async install(mod) {
                    return handleMod(mod, this.installPath ?? "", true);
                },
                async uninstall(mod) {
                    return handleMod(mod, this.installPath ?? "", false);
                },
            },
            {
                id: 2,
                name: "manifest",
                installPath: await join(
                    await FileHandler.getMyDocuments(),
                    "Euro Truck Simulator 2",
                    "mod",
                ),
                async install(mod) {
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "manifest.sii",
                        true,
                        false,
                        false,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "manifest.sii",
                        false,
                        false,
                        false,
                    );
                },
            },
            {
                id: 3,
                name: "versions",
                installPath: "",
                async install(_mod) {
                    ElMessage.warning(
                        "此 Mod 为创意工坊 Mod，请前往创意工坊订阅后再使用。",
                    );
                    return false;
                },
                async uninstall(_mod) {
                    return false;
                },
            },
            {
                id: 4,
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
            let scs = false;
            let manifest = false;
            let versions = false;

            for (const item of mod.modFiles) {
                if ((await FileHandler.getFileExtension(item)).toLowerCase() === "scs") scs = true;
                if ((await basename(item)).toLowerCase() === "manifest.sii")
                    manifest = true;
                if ((await basename(item)).toLowerCase() === "versions.sii")
                    versions = true;
            }

            if (scs) return 1;
            if (manifest) return 2;
            if (versions) return 3;

            return 99;
        },
    }) as ISupportedGames;
