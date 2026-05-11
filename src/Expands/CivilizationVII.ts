import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

/**
 * @description 文明7 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 434,
        steamAppID: 1295660,
        installdir: await join(
            "Sid Meier's Civilization VII",
            "Base",
            "Binaries",
            "Win64",
        ),
        gameName: "Sid Meier's Civilization VII",
        nexusMods: {
            game_domain_name: "civilizationvii",
            game_id: 7318,
        },
        gameExe: [
            {
                name: "Civ7_Win64_DX12_FinalRelease.exe",
                rootPath: ["..", "..", ".."],
            },
            {
                name: "Civ7_Win64_Vulkan_FinalRelease.exe",
                rootPath: ["..", "..", ".."],
            },
            {
                name: "FiraxisCrashReporter.exe",
                rootPath: ["..", "..", ".."],
            },
        ],
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1295660",
            },
            {
                name: "直接启动",
                exePath: await join(
                    "Base",
                    "Binaries",
                    "Win64",
                    "Civ7_Win64_DX12_FinalRelease.exe",
                ),
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "My Games",
            "Sid Meier's Civilization VII",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/logo/croppedImg_681b310c641ef.jpg",
        modType: [
            {
                id: 1,
                name: "mods",
                installPath: await join(
                    await FileHandler.GetAppData(),
                    "Local",
                    "Firaxis Games",
                    "Sid Meier's Civilization VII",
                    "Mods",
                ),
                async install(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "modinfo",
                        true,
                        true,
                        false,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFile(
                        mod,
                        this.installPath ?? "",
                        "modinfo",
                        false,
                        true,
                        false,
                    );
                },
            },
            {
                id: 99,
                name: "未知",
                installPath: "",
                async install(mod) {
                    void mod;
                    ElMessage.warning("未知类型, 请手动安装");
                    return false;
                },
                async uninstall(mod) {
                    void mod;
                    return true;
                },
            },
        ],
        async checkModType(mod) {
            // let loader = false
            let mods = false;

            for (const item of mod.modFiles) {
                // if (basename(item) == 'python35.dll') loader = true
                // 判断路径是否包含 data
                if ((await FileHandler.getFileExtension(item)) == "modinfo") mods = true;
            }

            // if (loader) return 1
            if (mods) return 1;

            return 99;
        },
    }) as ISupportedGames;
