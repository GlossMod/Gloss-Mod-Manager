import { basename, join } from "@tauri-apps/api/path";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

/**
 * @description 求生之路 2 支持
 */
async function handleVpk(
    mod: IModInfo,
    installPath: string,
    isInstall: boolean,
) {
    const modStorage = await Manager.getModStoragePath(mod.id);
    const { gameStorage } = await Manager.getContext();

    if (!modStorage || !gameStorage) {
        return [] as IState[];
    }

    const targetRoot = await join(gameStorage, installPath);
    const result: IState[] = [];

    for (const file of mod.modFiles) {
        if ((await FileHandler.getFileExtension(file)).toLowerCase() !== "vpk") {
            continue;
        }

        const target = await join(targetRoot, await basename(file));
        if (isInstall) {
            const state = await FileHandler.copyFile(
                await join(modStorage, file),
                target,
            );
            result.push({ file, state });
        } else {
            const state = await FileHandler.deleteFile(target);
            result.push({ file, state });
        }
    }

    return result;
}

export const supportedGames = async () =>
    ({
        GlossGameId: 12,
        steamAppID: 550,
        nexusMods: {
            game_domain_name: "left4dead2",
            game_id: 195,
        },
        installdir: "Left 4 Dead 2",
        gameName: "Left 4 Dead 2",
        gameExe: "left4dead2.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/550",
            },
            {
                name: "直接启动",
                exePath: "left4dead2.exe",
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/12.jpg",
        modType: [
            {
                id: 1,
                name: "通用类型",
                installPath: await join("left4dead2", "addons"),
                async install(mod) {
                    return handleVpk(mod, this.installPath ?? "", true);
                },
                async uninstall(mod) {
                    return handleVpk(mod, this.installPath ?? "", false);
                },
            },
        ],
        async checkModType(_mod) {
            return 1;
        },
    }) as ISupportedGames;
