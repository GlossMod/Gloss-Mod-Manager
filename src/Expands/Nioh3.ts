import { basename, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

/**
 * @description 仁王 3 支持
 */
async function runTools() {
    const { gameStorage } = await Manager.getContext();

    if (!gameStorage) {
        return;
    }

    const toolsPath = await join(
        gameStorage,
        "package",
        "yumia_mod_insert_into_rdb.exe",
    );
    await FileHandler.runExe(toolsPath);
}

export const supportedGames = async () =>
    ({
        GlossGameId: 486,
        steamAppID: 3681010,
        nexusMods: {
            game_domain_name: "nioh3",
            game_id: 3660,
        },
        installdir: await join("Nioh3"),
        gameName: "Nioh 3",
        gameExe: "Nioh3.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/3681010",
            },
            {
                name: "直接启动",
                exePath: "Nioh3.exe",
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/logo/croppedImg_699ec8ac99e3b.png",
        modType: [
            {
                id: 1,
                name: "tools",
                installPath: await join("package"),
                async install(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        ".exe",
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        ".exe",
                        false,
                        true,
                    );
                },
            },
            {
                id: 2,
                name: "fdata",
                installPath: await join("package"),
                async install(mod) {
                    await Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        ".fdata",
                        true,
                        true,
                    );
                    await runTools();
                    return true;
                },
                async uninstall(mod) {
                    await Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        ".fdata",
                        false,
                        true,
                    );
                    await runTools();
                    return true;
                },
            },
            {
                id: 3,
                name: "游戏根目录",
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
            let tools = false;
            let fdata = false;

            for (const item of mod.modFiles) {
                if ((await basename(item)) === "yumia_mod_insert_into_rdb.exe")
                    tools = true;
                if ((await FileHandler.getFileExtension(item)).toLowerCase() === "fdata")
                    fdata = true;
            }

            if (tools) return 1;
            if (fdata) return 2;

            return 99;
        },
    }) as ISupportedGames;
