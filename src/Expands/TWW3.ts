import { basename, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

/**
 * @description 全面战争：战锤 3 支持
 */
async function handlePack(
    mod: IModInfo,
    installPath: string,
    isInstall: boolean,
) {
    const modStorage = await Manager.getModStoragePath(mod.id);
    const { gameStorage } = await Manager.getContext();

    if (!modStorage || !gameStorage) {
        return false;
    }

    for (const item of mod.modFiles) {
        if ((await FileHandler.getFileExtension(item)).toLowerCase() !== "pack") {
            continue;
        }

        const source = await join(modStorage, item);
        const target = await join(
            gameStorage,
            installPath,
            await basename(item),
        );
        if (isInstall) {
            await FileHandler.copyFile(source, target);
        } else {
            await FileHandler.deleteFile(target);
        }
    }

    return true;
}

export const supportedGames = async () =>
    ({
        GlossGameId: 273,
        steamAppID: 1142710,
        nexusMods: {
            game_domain_name: "totalwarwarhammer3",
            game_id: 4717,
        },
        installdir: await join("Total War WARHAMMER III"),
        gameName: "Total War WARHAMMER III",
        gameExe: "Warhammer3.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1142710",
            },
            {
                name: "直接启动",
                exePath: "Warhammer3.exe",
            },
        ],
        archivePath: await join(
            await FileHandler.GetAppData(),
            "Roaming",
            "The Creative Assembly",
            "Warhammer3",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/61dbfe86987ba.png",
        modType: [
            {
                id: 1,
                name: "pack",
                installPath: "data",
                async install(mod) {
                    return handlePack(mod, this.installPath ?? "", true);
                },
                async uninstall(mod) {
                    return handlePack(mod, this.installPath ?? "", false);
                },
            },
            {
                id: 2,
                name: "UI",
                installPath: await join("data", "UI"),
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "ui",
                        true,
                        false,
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "ui",
                        false,
                        false,
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
            let pack = false;
            let ui = false;

            for (const item of mod.modFiles) {
                if ((await FileHandler.getFileExtension(item)).toLowerCase() === "pack")
                    pack = true;
                if (item.toLowerCase().includes("ui")) ui = true;
            }

            if (pack) return 1;
            if (ui) return 2;

            return 99;
        },
    }) as ISupportedGames;
