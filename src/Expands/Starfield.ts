import { basename, dirname, join } from "@tauri-apps/api/path";
import * as ini from "ini";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

type IniConfig = Record<string, Record<string, string | number> | undefined>;

async function readIniConfig(filePath: string) {
    const raw = await FileHandler.readFile(filePath, "");
    return ini.parse(raw) as IniConfig;
}

async function writeIniConfig(filePath: string, config: IniConfig) {
    await FileHandler.writeFile(filePath, ini.stringify(config));
}

async function setArchive() {
    try {
        const { gameStorage } = await Manager.getContext();
        if (!gameStorage) {
            return;
        }

        const iniPath = await join(gameStorage, "Starfield.ini");
        const config = await readIniConfig(iniPath);
        const archive = config.Archive ?? {};
        archive.bInvalidateOlderFiles = 1;
        archive.sResourceDataDirsFinal = "";
        config.Archive = archive;
        await writeIniConfig(iniPath, config);
    } catch (error) {
        ElMessage.error(`配置 Starfield.ini 失败: ${error}`);
    }
}

async function setPlugins(mod: IModInfo, install: boolean) {
    const pluginsPath = await join(
        await FileHandler.GetAppData(),
        "Local",
        "Starfield",
        "plugins.txt",
    );
    let entries = (await FileHandler.readFile(pluginsPath, ""))
        .split(/\r?\n/u)
        .map((item) => item.trim())
        .filter((item) => item !== "");

    const header =
        "# This file is used by Starfield to keep track of your downloaded content. (You HAVE to keep a # on the first line here)";
    if (entries[0] !== header) {
        entries = [header, ...entries.filter((item) => item !== header)];
    }

    for (const item of mod.modFiles) {
        const extension = await FileHandler.getFileExtension(item);
        if (extension !== "esp" && extension !== "esm") {
            continue;
        }

        const entry = `*${await basename(item)}`;
        if (install) {
            if (!entries.includes(entry)) {
                entries.push(entry);
            }
        } else {
            entries = entries.filter((value) => value !== entry);
        }
    }

    await FileHandler.writeFile(pluginsPath, [...new Set(entries)].join("\n"));
}

async function setGeneral(name: string, isInstall: boolean) {
    const { gameStorage } = await Manager.getContext();
    if (!gameStorage) {
        return;
    }

    const iniPath = await join(gameStorage, "Starfield.ini");
    const config = await readIniConfig(iniPath);
    const general = (config.General ?? {}) as Record<string, string | number>;
    const keys = Object.keys(general);

    if (isInstall) {
        const exists = keys.some((key) => String(general[key]) === name);
        if (!exists) {
            const testKeys = keys.filter((key) => key.startsWith("sTestFile"));
            const lastIndex = Math.max(
                0,
                ...testKeys.map(
                    (key) => Number(key.replace("sTestFile", "")) || 0,
                ),
            );
            general[`sTestFile${lastIndex + 1}`] = name;
        }
    } else {
        for (const key of keys) {
            if (String(general[key]) === name) {
                delete general[key];
            }
        }
    }

    config.General = general;
    await writeIniConfig(iniPath, config);
}

async function handlePlugins(
    mod: IModInfo,
    installPath: string,
    isInstall: boolean,
) {
    if (isInstall) {
        Manager.checkInstalled("SFSE", 201756);
    }

    return Manager.installByFolder(
        mod,
        installPath,
        "plugins",
        isInstall,
        false,
        true,
    );
}

async function handleEsps(
    mod: IModInfo,
    installPath: string,
    isInstall: boolean,
) {
    const modStorage = await Manager.getModStoragePath(mod.id);
    const { gameStorage } = await Manager.getContext();

    if (!modStorage || !gameStorage) {
        return false;
    }

    for (const item of mod.modFiles) {
        const source = await join(modStorage, item);
        if (!(await FileHandler.isFile(source))) {
            continue;
        }

        const name = await basename(source);
        const extension = await FileHandler.getFileExtension(source);
        if (extension === "esp") {
            await setGeneral(name, isInstall);
        }

        const target = await join(gameStorage, installPath, name);
        if (isInstall) {
            await FileHandler.copyFile(source, target);
        } else {
            await FileHandler.deleteFile(target);
        }
    }

    return true;
}

async function getBaseFolder(mod: IModInfo) {
    for (const item of mod.modFiles) {
        if ((await basename(item)) === "sfse_loader.exe") {
            return await dirname(item);
        }
    }
    return "";
}

async function handleSfse(mod: IModInfo, install: boolean) {
    const modStorage = await Manager.getModStoragePath(mod.id);
    const { gameStorage } = await Manager.getContext();

    if (!modStorage || !gameStorage) {
        return false;
    }

    const baseFolder = await getBaseFolder(mod);
    if (baseFolder === "") {
        ElMessage.error("未找到 sfse_loader.exe，请不要随意修改 Mod 类型");
        return false;
    }

    for (const item of mod.modFiles) {
        const source = await join(modStorage, item);
        if (!(await FileHandler.isFile(source))) {
            continue;
        }

        const relativePath =
            baseFolder === "."
                ? item
                : await FileHandler.relativePath(baseFolder, item);
        const target = await join(gameStorage, relativePath);
        if (install) {
            await FileHandler.copyFile(source, target);
        } else {
            await FileHandler.deleteFile(target);
        }
    }

    return true;
}

/**
 * @description 星空支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 321,
        steamAppID: 1716740,
        nexusMods: {
            game_domain_name: "starfield",
            game_id: 4187,
        },
        installdir: await join("Starfield"),
        gameName: "Starfield",
        gameExe: "Starfield.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1716740",
            },
            {
                name: "SFSE 启动",
                exePath: "sfse_loader.exe",
            },
            {
                name: "直接启动",
                exePath: "Starfield.exe",
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "My Games",
            "Starfield",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/64db454e9f5c4.webp",
        modType: [
            {
                id: 1,
                name: "data",
                installPath: await join("Data"),
                async install(mod) {
                    await setArchive();
                    await setPlugins(mod, true);
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "data",
                        true,
                        false,
                        true,
                    );
                },
                async uninstall(mod) {
                    await setPlugins(mod, false);
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "data",
                        false,
                        false,
                        true,
                    );
                },
            },
            {
                id: 2,
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
                id: 3,
                name: "sfse",
                installPath: "",
                async install(mod) {
                    return handleSfse(mod, true);
                },
                async uninstall(mod) {
                    return handleSfse(mod, false);
                },
            },
            {
                id: 4,
                name: "Plugins",
                installPath: await join("Data", "SFSE", "plugins"),
                async install(mod) {
                    return handlePlugins(mod, this.installPath ?? "", true);
                },
                async uninstall(mod) {
                    return handlePlugins(mod, this.installPath ?? "", false);
                },
            },
            {
                id: 5,
                name: "esp",
                installPath: await join("Data"),
                async install(mod) {
                    return handleEsps(mod, this.installPath ?? "", true);
                },
                async uninstall(mod) {
                    return handleEsps(mod, this.installPath ?? "", false);
                },
            },
            {
                id: 99,
                name: "未知",
                installPath: "",
                async install(_mod) {
                    ElMessage.warning(
                        "该 Mod 类型未知，无法自动安装，请手动安装。",
                    );
                    return false;
                },
                async uninstall(_mod) {
                    return true;
                },
            },
        ],
        async checkModType(mod) {
            let data = false;
            let plugins = false;
            let esp = false;
            let sfse = false;

            for (const item of mod.modFiles) {
                const extension = await FileHandler.getFileExtension(item);
                if (item.toLowerCase().includes("data")) data = true;
                if (item.toLowerCase().includes("plugins")) plugins = true;
                if (extension === "esp" || extension === "esm") esp = true;
                if ((await basename(item)) === "sfse_loader.exe") sfse = true;
            }

            if (sfse) return 3;
            if (plugins) return 4;
            if (esp && !data) return 5;
            if (data) return 1;

            return 99;
        },
    }) as ISupportedGames;
