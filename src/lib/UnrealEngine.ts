import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";
import { dirname, join } from "@tauri-apps/api/path";

export class UnrealEngine {
    public static async modType(
        bassPath: string = "",
        useUE4SS: boolean = false,
    ): Promise<ISupportedGames["modType"]> {
        return [
            {
                id: 1,
                name: "pak",
                installPath: await join(bassPath, "Content", "Paks"),
                advanced: {
                    name: "配置",
                    icon: "mdi-align-horizontal-center",
                    item: [
                        {
                            type: "input",
                            label: "安装位置",
                            key: "installPath",
                            defaultValue: useUE4SS ? "LogicMods" : "~mods",
                        },
                    ],
                },
                async install(mod) {
                    const subPath = mod.advanced?.enabled
                        ? String(mod.advanced?.data.installPath ?? "")
                        : String(this.advanced?.item[0]?.defaultValue ?? "");
                    const installPath = await join(
                        this.installPath ?? "",
                        subPath,
                    );

                    return Manager.generalInstall(mod, installPath);
                },
                async uninstall(mod) {
                    const subPath = mod.advanced?.enabled
                        ? String(mod.advanced?.data.installPath ?? "")
                        : String(this.advanced?.item[0]?.defaultValue ?? "");
                    const installPath = await join(
                        this.installPath ?? "",
                        subPath,
                    );

                    return Manager.generalUninstall(mod, installPath);
                },
            },
            {
                id: 2,
                name: "UE4SS",
                installPath: await join(bassPath, "Binaries", "Win64"),
                async install(mod) {
                    for (const item of mod.modFiles) {
                        if (
                            await FileHandler.compareFileName(
                                item,
                                "dwmapi.dll",
                            )
                        ) {
                            return Manager.installByFileSibling(
                                mod,
                                this.installPath ?? "",
                                "dwmapi.dll",
                                true,
                            );
                        }

                        if (
                            await FileHandler.compareFileName(
                                item,
                                "xinput1_3.dll",
                            )
                        ) {
                            return Manager.installByFileSibling(
                                mod,
                                this.installPath ?? "",
                                "xinput1_3.dll",
                                true,
                            );
                        }
                    }

                    ElMessage.warning(
                        "未找到dwmapi.dll或xinput1_3.dll, 类型可能错误, 请重新导入! ",
                    );

                    return false;
                },
                async uninstall(mod) {
                    for (const item of mod.modFiles) {
                        if (
                            await FileHandler.compareFileName(
                                item,
                                "dwmapi.dll",
                            )
                        ) {
                            return Manager.installByFileSibling(
                                mod,
                                this.installPath ?? "",
                                "dwmapi.dll",
                                false,
                            );
                        }

                        if (
                            await FileHandler.compareFileName(
                                item,
                                "xinput1_3.dll",
                            )
                        ) {
                            return Manager.installByFileSibling(
                                mod,
                                this.installPath ?? "",
                                "xinput1_3.dll",
                                false,
                            );
                        }
                    }

                    ElMessage.warning(
                        "未找到dwmapi.dll或xinput1_3.dll, 类型可能错误, 请重新导入! ",
                    );

                    return false;
                },
            },
            {
                id: 3,
                name: "mods",
                installPath: await join(
                    bassPath,
                    "Binaries",
                    "Win64",
                    "ue4ss",
                    "Mods",
                ),
                async install(mod) {
                    return Manager.installByFolderParent(
                        mod,
                        this.installPath ?? "",
                        "Enabled.txt",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolderParent(
                        mod,
                        this.installPath ?? "",
                        "Enabled.txt",
                        false,
                    );
                },
            },
            {
                id: 4,
                name: "LogicMods",
                installPath: await join(
                    bassPath,
                    "Content",
                    "Paks",
                    "LogicMods",
                ),
                async install(mod) {
                    return Manager.generalInstall(mod, this.installPath ?? "");
                },
                async uninstall(mod) {
                    return Manager.generalUninstall(
                        mod,
                        this.installPath ?? "",
                    );
                },
            },
            {
                id: 5,
                name: "Scripts",
                installPath: await join(
                    bassPath,
                    "Binaries",
                    "Win64",
                    "ue4ss",
                    "Mods",
                ),
                async install(mod) {
                    let parent = "";

                    for (const element of mod.modFiles) {
                        const parts = FileHandler.pathToArray(element);

                        if (parts.includes("Scripts")) {
                            parent = await dirname(element);
                            break;
                        }
                    }

                    const modStorage = await Manager.getModStoragePath(mod.id);
                    const enableFile = await join(
                        modStorage,
                        parent,
                        "Enabled.txt",
                    );

                    await FileHandler.ensureDirectoryExistence(enableFile);

                    return Manager.installByFolderParent(
                        mod,
                        this.installPath ?? "",
                        "Scripts",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolderParent(
                        mod,
                        this.installPath ?? "",
                        "Scripts",
                        false,
                    );
                },
            },
            {
                id: 6,
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
                    ElMessage.warning(
                        "该mod类型未知, 无法自动安装, 请手动安装!",
                    );
                    return false;
                },
                async uninstall(_mod) {
                    return true;
                },
            },
        ];
    }

    public static async checkModType(mod: IModInfo) {
        let pak = false;
        let ue4ss = false;
        let mods = false;
        let scripts = false;

        for (const item of mod.modFiles) {
            if ((await FileHandler.getFileExtension(item)) === "pak") pak = true;
            if (await FileHandler.compareFileName(item, "Enabled.txt"))
                mods = true;
            if (await FileHandler.compareFileName(item, "ue4ss.dll"))
                ue4ss = true;
            if (await FileHandler.compareFileName(item, "dwmapi.dll"))
                ue4ss = true;
            if (await FileHandler.compareFileName(item, "xinput1_3.dll"))
                ue4ss = true;
            if (FileHandler.pathToArray(item).includes("Scripts")) {
                scripts = true;
            }
        }

        if (ue4ss) return 2;
        if (pak) return 1;
        if (mods) return 3;
        if (scripts) return 5;

        return 99;
    }

    public static async setBPModLoaderMod(bassPath: string) {
        const { gameStorage } = await Manager.getContext();

        if (!gameStorage) {
            ElMessage.warning(
                "未设置游戏目录，无法修改 mods.txt。请先调用 Manager.configureContext 配置 gameStorage。",
            );
            return;
        }

        const filePath = await join(
            gameStorage,
            bassPath,
            "Binaries",
            "Win64",
            "Mods",
            "mods.txt",
        );

        if (!(await FileHandler.fileExists(filePath))) {
            ElMessage.warning(
                "未找到mods.txt, 部分Mod可能不生效, 请确保您已安装 UE4SS !",
            );
            return;
        }

        let data = await FileHandler.readFile(filePath, "");
        data = data.replace(/BPModLoaderMod : 0/g, "BPModLoaderMod : 1");
        await FileHandler.writeFile(filePath, data);
    }
}
