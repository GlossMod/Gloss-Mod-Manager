import { join, basename } from "@tauri-apps/api/path";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";
import { UnityGame } from "@/lib/UnityGame";

/**
 * @description 大侠立志传 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 310,
        steamAppID: 1948980,
        installdir: await join("WulinSH"),
        gameName: "WulinSH",
        gameExe: "Wulin.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1948980",
            },
            {
                name: "直接启动",
                exePath: await join("Wulin.exe"),
            },
        ],
        archivePath: await join(
            await FileHandler.GetAppData(),
            "LocalLow",
            "DefaultCompany",
            "Wulin",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/641d08aca63ce.webp",
        modType: [
            {
                id: 4,
                name: "mods",
                installPath: await join("Mods"),
                async install(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "Info.json",
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "Info.json",
                        false,
                    );
                },
            },
            ...(await UnityGame.modType()),
        ],
        async checkModType(mod) {
            let BepInEx = false;
            let plugins = false;
            let mods = false;

            for (const item of mod.modFiles) {
                if ((await basename(item)).toLowerCase() == "winhttp.dll")
                    BepInEx = true;
                if ((await FileHandler.getFileExtension(item)) == "dll") plugins = true;
                if (
                    (await basename(item)).toLowerCase() ==
                    "Info.json".toLowerCase()
                )
                    mods = true;
            }

            if (mods) return 4;
            if (BepInEx) return 1;
            if (plugins) return 2;

            return 99;
        },
    }) as ISupportedGames;
