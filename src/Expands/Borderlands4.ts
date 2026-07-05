import { join } from "@tauri-apps/api/path";
import { FileHandler } from "@/lib/FileHandler";
import { UnrealEngine } from "@/lib/UnrealEngine";

/**
 * @description 无主之地4 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 453,
        steamAppID: 1285190,
        nexusMods: {
            game_domain_name: "borderlands4",
            game_id: 8148,
        },
        installdir: await join("Borderlands 4"),
        gameName: "Borderlands 4",
        gameExe: [
            {
                rootPath: ["..", "..", ".."],
                name: "Borderlands4.exe",
            },
            {
                rootPath: ["..", "..", ".."],
                name: "OakGame-Win64-Shipping.exe",
            },
        ],
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1285190",
            },
            {
                name: "直接启动",
                exePath: await join(
                    "OakGame",
                    "Binaries",
                    "Win64",
                    "Borderlands4.exe",
                ),
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "My Games",
            "Borderlands 4",
            "Saved",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/logo/croppedImg_68c3711a6f87b.jpg",
        modType: await UnrealEngine.modType("OakGame", false),
        checkModType: UnrealEngine.checkModType,
    }) as ISupportedGames;
