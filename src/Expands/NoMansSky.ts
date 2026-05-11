import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

/**
 * @description 无人深空 支持
 */
async function renameDisableModsFile() {
    const { gameStorage } = await Manager.getContext();

    if (!gameStorage) {
        return;
    }

    const gameBankPath = await join(gameStorage, "GAMEDATA", "PCBANKS");
    const disabledFile = await join(gameBankPath, "DISABLEMODS.TXT");
    const backupFile = await join(gameBankPath, "DISABLEMODS.TXT.bak");

    if (await FileHandler.fileExists(disabledFile)) {
        await FileHandler.renameFile(disabledFile, backupFile);
    }
}

export const supportedGames = async () =>
    ({
        GlossGameId: 24,
        steamAppID: 275850,
        nexusMods: {
            game_domain_name: "nomanssky",
            game_id: 1634,
        },
        installdir: await join("No Man's Sky", "Binaries"),
        gameName: "No Man's Sky",
        gameExe: [
            {
                name: "NMS.exe",
                rootPath: [".."],
            },
        ],
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/275850",
            },
            {
                name: "直接启动",
                exePath: await join("Binaries", "NMS.exe"),
            },
        ],
        archivePath: await join(
            await FileHandler.GetAppData(),
            "Roaming",
            "HelloGames",
            "NMS",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/24.jpg",
        modType: [
            {
                id: 1,
                name: "pak/lua",
                installPath: await join("GAMEDATA", "PCBANKS", "MODS"),
                async install(mod) {
                    await renameDisableModsFile();
                    return Manager.generalInstall(
                        mod,
                        this.installPath ?? "",
                        false,
                    );
                },
                async uninstall(mod) {
                    return Manager.generalUninstall(
                        mod,
                        this.installPath ?? "",
                        false,
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
            for (const item of mod.modFiles) {
                const extension = await FileHandler.getFileExtension(item);
                if (extension === "pak" || extension === "lua") {
                    return 1;
                }
            }

            return 99;
        },
    }) as ISupportedGames;
