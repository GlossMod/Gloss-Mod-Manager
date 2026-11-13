import { UnrealEngine } from "@/lib/UnrealEngine";

export const supportedGames = async () =>
    ({
        GlossGameId: 565,
        steamAppID: 2486820,
        gamebanana: 21640,
        installdir: "SonicRacingCrossWorlds",
        gameName: "Sonic Racing CrossWorlds",
        gameExe: "SonicRacingCrossWorlds.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/2486820",
            },
            {
                name: "直接启动",
                exePath: "SonicRacingCrossWorlds.exe",
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/logo/202610/MODee9546765b1d6a5fc49ae1f25a0ee1ac.png",
        modType: await UnrealEngine.modType("UNION", false),
        checkModType: UnrealEngine.checkModType,
    }) as ISupportedGames;
