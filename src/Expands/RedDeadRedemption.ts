import { basename } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";

export const supportedGames = async () =>
    ({
        GlossGameId: 398,
        steamAppID: 2668510,
        nexusMods: {
            game_domain_name: "reddeadredemption",
            game_id: 5175,
        },
        gameName: "Red Dead Redemption",
        installdir: "Red Dead Redemption",
        gameExe: "RDR.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/2668510",
            },
            {
                name: "直接启动",
                exePath: "RDR.exe",
            },
        ],
        // archivePath: join(await FileHandler.GetAppData(), "Local", "SparkingZERO", "Saved"),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/mod/202410/MOD6721f29b85384.jpg@webp",
        modType: [
            {
                id: 1,
                name: "ScriptHookRDR",
                installPath: "",
                async install(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "dinput8.dll",
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "dinput8.dll",
                        false,
                    );
                },
            },
            {
                id: 2,
                name: "RedHook",
                installPath: "",
                async install(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "RedHook.dll",
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "RedHook.dll",
                        false,
                    );
                },
            },
            {
                id: 3,
                name: "asi",
                installPath: "",
                async install(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "asi",
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "asi",
                        false,
                        true,
                    );
                },
            },
            {
                id: 4,
                name: "red",
                installPath: "",
                async install(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "red",
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    void mod;
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "red",
                        false,
                        true,
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
            let ScriptHookRDR = false;
            let RedHook = false;
            let asi = false;
            let red = false;

            for (const item of mod.modFiles) {
                if ((await basename(item)) == "dinput8.dll")
                    ScriptHookRDR = true;
                if ((await basename(item)) == "RedHook.dll") RedHook = true;
                if ((await FileHandler.getFileExtension(item)) == "asi") asi = true;
                if ((await FileHandler.getFileExtension(item)) == "red") red = true;
            }

            if (ScriptHookRDR) return 1;
            if (RedHook) return 2;
            if (asi) return 3;
            if (red) return 4;

            return 99;
        },
    }) as ISupportedGames;
