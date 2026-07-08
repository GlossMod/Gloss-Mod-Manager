/**
 * @description 刺客信条 奥德赛 支持
 */
import { Manager } from "@/lib/Manager";
import { join, extname } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";

export const supportedGames = async () =>
    ({
        GlossGameId: 417,
        steamAppID: 812140,
        nexusMods: {
            game_domain_name: "assassinscreedodyssey",
            game_id: 2610,
        },
        installdir: await join("Assassins Creed Odyssey"),
        gameName: "Assassins Creed Odyssey",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/812140",
            },
            {
                name: "直接启动",
                exePath: "ACOdyssey.exe",
            },
        ],
        gameExe: "ACOdyssey.exe",
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/mod/202502/MOD67a5c94a7b758.webp@webp",
        modType: [
            {
                id: 1,
                name: "forger2",
                installPath: await join("ForgerPatches"),
                async install(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath,
                        ".forger2",
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath,
                        ".forger2",
                        false,
                        true,
                    );
                },
            },
            {
                id: 2,
                name: "游戏根目录",
                installPath: await join(""),
                async install(mod) {
                    return Manager.generalInstall(mod, this.installPath, true);
                },
                async uninstall(mod) {
                    return Manager.generalUninstall(
                        mod,
                        this.installPath,
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
                        "该mod类型未知, 无法自动安装, 请手动安装!",
                    );
                    return false;
                },
                async uninstall(_mod) {
                    return true;
                },
            },
        ],
        async checkModType(mod) {
            let forger2 = false;
            let gameRoot = false;

            const gameRootList = [".dll", ".ini", ".exe"];

            mod.modFiles.forEach(async (file) => {
                if ((await extname(file)) === ".forger2") {
                    forger2 = true;
                }
                if (gameRootList.includes(await extname(file))) {
                    gameRoot = true;
                }
            });

            if (forger2) return 1;
            if (gameRoot) return 2;

            return 99;
        },
    }) as ISupportedGames;
