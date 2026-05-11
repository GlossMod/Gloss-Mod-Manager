import { join, basename } from "@tauri-apps/api/path";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";
import { UnityGame } from "@/lib/UnityGame";

/**
 * @description 城市天际线2 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 326,
        steamAppID: 949230,
        Thunderstore: {
            community_identifier: "cities-skylines-ii",
        },
        nexusMods: {
            game_domain_name: "citiesskylines2",
            game_id: 5833,
        },
        installdir: await join("Cities Skylines II"),
        gameName: "Cities Skylines II",
        gameExe: "Cities2.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/949230",
            },
            {
                name: "直接启动",
                exePath: await join("Cities2.exe"),
            },
        ],
        archivePath: await join(
            await FileHandler.GetAppData(),
            "LocalLow",
            "Colossal Order",
            "Cities Skylines II",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/6535dbba96ba3.webp",
        modType: [
            {
                id: 4,
                name: "Map",
                installPath: "",
                async install(mod) {
                    void mod;
                    // "%UserProfile%\AppData\LocalLow\Colossal Order\Cities Skylines II\Maps"
                    let installPath = await join(
                        await FileHandler.GetAppData(),
                        "LocalLow",
                        "Colossal Order",
                        "Cities Skylines II",
                        "Maps",
                    );
                    return Manager.installByFileSibling(
                        mod,
                        installPath,
                        "cok",
                        true,
                        true,
                        false,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    let installPath = await join(
                        await FileHandler.GetAppData(),
                        "LocalLow",
                        "Colossal Order",
                        "Cities Skylines II",
                        "Maps",
                    );
                    return Manager.installByFileSibling(
                        mod,
                        installPath,
                        "cok",
                        false,
                        true,
                        false,
                    );
                },
            },
            ...(await UnityGame.modType()),
        ],
        async checkModType(mod) {
            let BepInEx = false;
            let plugins = false;
            let map = false;

            for (const item of mod.modFiles) {
                if ((await basename(item)).toLowerCase() == "winhttp.dll")
                    BepInEx = true;
                if ((await FileHandler.getFileExtension(item)) == "dll") plugins = true;
                if ((await FileHandler.getFileExtension(item)) == "cok") map = true;
            }

            if (BepInEx) return 1;
            if (plugins) return 2;
            if (map) return 4;

            return 99;
        },
    }) as ISupportedGames;
