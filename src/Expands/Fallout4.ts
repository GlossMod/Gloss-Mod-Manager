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
            "Fallout4",
            "Fallout4.ini",
        );
        const config = await readIniConfig(iniPath);
        const archive = config.Archive ?? {};
        archive.bInvalidateOlderFiles = 1;
        archive.sResourceDataDirsFinal = "";
        config.Archive = archive;
        await writeIniConfig(iniPath, config);
    } catch (error) {
        console.log(`配置 Fallout4.ini 失败: ${error}`);
    }
}

async function setPlugins(mod: IModInfo, install: boolean) {
    const pluginsPath = await join(
        await FileHandler.GetAppData(),
        "Local",
        "Fallout4",
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
 * @description 辐射 4 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 6,
        steamAppID: 377160,
        nexusMods: {
            game_domain_name: "fallout4",
            game_id: 1151,
        },
        installdir: await join("Fallout 4"),
        gameName: "Fallout 4",
        gameExe: [
            {
                name: "Fallout4.exe",
                rootPath: ["."],
            },
            {
                name: "Fallout4Launcher.exe",
                rootPath: ["."],
            },
        ],
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/377160",
            },
            {
                name: "直接启动",
                exePath: "Fallout4.exe",
            },
            {
                name: "F4SE 启动",
                exePath: "f4se_loader.exe",
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "My Games",
            "Fallout4",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/6b.png",
        modType: [
            {
                id: 1,
                name: "Plugins",
                installPath: await join("Data", "F4SE", "plugins"),
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
                id: 2,
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
                id: 3,
                name: "f4se",
                installPath: "",
                async install(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "f4se_loader.exe",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "f4se_loader.exe",
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
            let plugins = false;
            let f4se = false;

            for (const item of mod.modFiles) {
                const extension = await FileHandler.getFileExtension(item);
                if (extension === "dll") plugins = true;
                if ((await basename(item)).toLowerCase().includes("data"))
                    data = true;
                if ((await basename(item)) === "f4se_loader.exe") f4se = true;
                if (extension === "esp" || extension === "esm") data = true;
            }

            if (f4se) return 3;
            if (data) return 2;
            if (plugins) return 1;

            return 99;
        },
    }) as ISupportedGames;
