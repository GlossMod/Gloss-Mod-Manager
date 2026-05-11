import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { ScanGame } from "@/lib/scan-game";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 怪物猎人世界支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 161,
        steamAppID: 582010,
        nexusMods: {
            game_domain_name: "monsterhunterworld",
            game_id: 2531,
        },
        installdir: "Monster Hunter World",
        gameName: "Monster Hunter World",
        gameExe: "MonsterHunterWorld.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/582010",
            },
            {
                name: "直接启动",
                exePath: "MonsterHunterWorld.exe",
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/161b.png",
        archivePath: await join(
            (await ScanGame.getSteamInstallPath()) || "",
            "userdata",
            await ScanGame.GetLastSteamId32(),
            "582010",
            "remote",
        ),
        modType: [
            {
                id: 1,
                name: "Stracker's Loader",
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
                name: "通用类型",
                installPath: "nativePC",
                async install(mod) {
                    if (!Manager.checkInstalled("Stracker's Loader", 197740)) {
                        return false;
                    }

                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "nativePC",
                        true,
                        false,
                        false,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "nativePC",
                        false,
                        false,
                        false,
                    );
                },
            },
            {
                id: 3,
                name: "插件",
                installPath: await join("nativePC", "plugins"),
                async install(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        ".dll",
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        ".dll",
                        false,
                        true,
                    );
                },
            },
            {
                id: 4,
                name: "未知",
                installPath: "",
                async install(_mod) {
                    ElMessage.warning(
                        "该 Mod 类型未知，无法自动安装，请手动安装。",
                    );
                    return false;
                },
                async uninstall(_mod) {
                    return false;
                },
            },
        ],
        async checkModType(mod) {
            if (mod.webId === 197740) return 1;

            let nativePC = false;
            let plugins = false;
            for (const item of mod.modFiles) {
                if (item.toLowerCase().includes("nativepc")) nativePC = true;
                if ((await FileHandler.getFileExtension(item)).toLowerCase() === "dll")
                    plugins = true;
            }

            if (nativePC) return 2;
            if (plugins) return 3;

            return 4;
        },
    }) as ISupportedGames;
