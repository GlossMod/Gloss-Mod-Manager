import { basename, join } from "@tauri-apps/api/path";
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
        const iniPath = await join(
            await FileHandler.getMyDocuments(),
            "My Games",
            "Skyrim Special Edition",
            "Skyrim.ini",
        );
        const config = await readIniConfig(iniPath);
        const archive = config.Archive ?? {};
        archive.bInvalidateOlderFiles = 1;
        archive.sResourceDataDirsFinal = "";
        config.Archive = archive;
        await writeIniConfig(iniPath, config);
    } catch (error) {
        ElMessage.error(`配置 Skyrim.ini 失败: ${error}`);
    }
}

async function setPlugins(mod: IModInfo, install: boolean) {
    const pluginsPath = await join(
        await FileHandler.GetAppData(),
        "Local",
        "Skyrim Special Edition",
        "plugins.txt",
    );
    let entries = (await FileHandler.readFile(pluginsPath, ""))
        .split(/\r?\n/u)
        .map((item) => item.trim())
        .filter((item) => item !== "");

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

/**
 * @description 上古卷轴 5：天际 特别版支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 2,
        steamAppID: 489830,
        nexusMods: {
            game_domain_name: "skyrimspecialedition",
            game_id: 1704,
        },
        installdir: await join("Skyrim Special Edition"),
        gameName: "Skyrim Special Edition",
        gameExe: "SkyrimSE.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/489830",
            },
            {
                name: "直接启动",
                exePath: "SkyrimSE.exe",
            },
            {
                name: "skse 启动",
                exePath: "skse64_loader.exe",
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "My Games",
            "Skyrim Special Edition",
        ),
        gameCoverImg: "https://assets-mod.3dmgame.com/static/upload/game/2.jpg",
        modType: [
            {
                id: 1,
                name: "Data",
                installPath: "Data",
                async install(mod) {
                    await setPlugins(mod, true);
                    await setArchive();
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
                name: "skse64",
                installPath: "",
                async install(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "skse64_loader.exe",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "skse64_loader.exe",
                        false,
                    );
                },
            },
            {
                id: 3,
                name: "Plugins",
                installPath: await join("Data", "SKSE"),
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "plugins",
                        true,
                        true,
                        false,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "plugins",
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
            let data = false;
            let skse = false;
            let plugins = false;

            for (const item of mod.modFiles) {
                const extension = await FileHandler.getFileExtension(item);
                if (item.toLowerCase().includes("data")) data = true;
                if (item.toLowerCase().includes("plugins")) plugins = true;
                if ((await basename(item)) === "skse64_loader.exe") skse = true;
                if (extension === "esp" || extension === "esm") data = true;
            }

            if (skse) return 2;
            if (data) return 1;
            if (plugins) return 3;

            return 99;
        },
    }) as ISupportedGames;
