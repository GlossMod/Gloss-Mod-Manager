import { join } from "@tauri-apps/api/path";
import { UnityGame } from "@/lib/UnityGame";

/**
 * @description 空洞骑士 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 466,
        steamAppID: 367520,
        nexusMods: {
            game_domain_name: "hollowknight",
            game_id: 2698,
        },
        installdir: await join("Hollow Knight"),
        gameName: "Hollow Knight",
        gameExe: "hollow_knight.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/367520",
            },
            {
                name: "直接启动",
                exePath: await join("hollow_knight.exe"),
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/logo/croppedImg_68ef7e4cbc70c.png",
        modType: await UnityGame.modType(),
        checkModType: UnityGame.checkModType,
    }) as ISupportedGames;
