import { join } from "@tauri-apps/api/path";
import { FileHandler } from "@/lib/FileHandler";
import { UnrealEngine } from "@/lib/UnrealEngine";

/**
 * @description 无主之地3 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 200,
        steamAppID: 397540,
        nexusMods: {
            game_domain_name: "borderlands3",
            game_id: 2953,
        },
        installdir: await join("Borderlands 3"),
        gameName: "Borderlands 3",
        gameExe: [
            {
                rootPath: ["..", "..", ".."],
                name: "Borderlands3.exe",
            },
        ],
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/397540",
            },
            {
                name: "直接启动",
                exePath: await join(
                    "OakGame",
                    "Binaries",
                    "Win64",
                    "Borderlands3.exe",
                ),
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "My Games",
            "Borderlands 3",
            "Saved",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/188_1.png",
        modType: await UnrealEngine.modType("OakGame", false),
        checkModType: UnrealEngine.checkModType,
    }) as ISupportedGames;
