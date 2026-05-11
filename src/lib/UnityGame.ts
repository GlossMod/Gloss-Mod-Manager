/**
 * Unity 引擎 通用安装
 */

import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { basename, join } from "@tauri-apps/api/path";
import { FileHandler } from "@/lib/FileHandler";

export class UnityGame {
    static modType = async () =>
        [
            {
                id: 1,
                name: "BepInEx",
                installPath: "",
                async install(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "winhttp.dll",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "winhttp.dll",
                        false,
                    );
                },
            },
            {
                id: 2,
                name: "plugins",
                installPath: await join("BepInEx", "plugins"),
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "plugins",
                        true,
                        false,
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "plugins",
                        false,
                        false,
                        true,
                    );
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
                    ElMessage.warning("未知类型, 请手动安装");
                    return false;
                },
                async uninstall(_mod) {
                    return true;
                },
            },
        ] as ISupportedGames["modType"];

    static async checkModType(mod: IModInfo) {
        let bepinEx = false;
        let plugins = false;

        for (const item of mod.modFiles) {
            if ((await basename(item)).toLowerCase() === "winhttp.dll") {
                bepinEx = true;
            }

            if ((await FileHandler.getFileExtension(item)) === "dll") {
                plugins = true;
            }

            if ((await basename(item)).toLowerCase().includes("plugins")) {
                plugins = true;
            }
        }

        if (bepinEx) return 1;
        if (plugins) return 2;

        return 99;
    }
}

export class UnityGameILCPP2 {
    static modType: ISupportedGames["modType"] = [
        {
            id: 1,
            name: "MelonLoader",
            installPath: "",
            async install(mod) {
                return Manager.installByFileSibling(
                    mod,
                    this.installPath ?? "",
                    "version.dll",
                    true,
                );
            },
            async uninstall(mod) {
                return Manager.installByFileSibling(
                    mod,
                    this.installPath ?? "",
                    "version.dll",
                    false,
                );
            },
        },
        {
            id: 2,
            name: "mods",
            installPath: "mods",
            async install(mod) {
                return Manager.installByFileSibling(
                    mod,
                    this.installPath ?? "",
                    "dll",
                    true,
                    true,
                );
            },
            async uninstall(mod) {
                return Manager.installByFileSibling(
                    mod,
                    this.installPath ?? "",
                    "dll",
                    false,
                    true,
                );
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
                ElMessage.warning("未知类型, 请手动安装");
                return false;
            },
            async uninstall(_mod) {
                return true;
            },
        },
    ];

    static async checkModType(mod: IModInfo) {
        let melonLoader = false;
        let mods = false;

        for (const item of mod.modFiles) {
            if ((await basename(item)).toLowerCase() === "version.dll") {
                melonLoader = true;
            }

            if ((await FileHandler.getFileExtension(item)) === "dll") {
                mods = true;
            }
        }

        if (melonLoader) return 1;
        if (mods) return 2;

        return 99;
    }
}
