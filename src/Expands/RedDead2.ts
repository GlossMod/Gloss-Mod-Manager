import { basename, dirname, join } from "@tauri-apps/api/path";
import { Builder, parseStringPromise } from "xml2js";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

type RedDeadModsXml = {
    ModsManager: {
        Mods: Array<{
            Mod?: Array<{
                $?: {
                    folder?: string;
                };
                Name?: string[];
                Enabled?: Array<boolean | string>;
                Overwrite?: string[];
                DisabledGroups?: string[];
            }>;
        }>;
        LoadOrder: Array<{
            Mod?: string[];
        }>;
    };
};

async function readModsXmlData(): Promise<RedDeadModsXml> {
    const { gameStorage } = await Manager.getContext();

    if (!gameStorage) {
        return {
            ModsManager: {
                Mods: [{ Mod: [] }],
                LoadOrder: [{ Mod: [] }],
            },
        };
    }

    const filePath = await join(gameStorage, "lml", "mods.xml");
    const raw = await FileHandler.readFile(
        filePath,
        `<ModsManager><Mods /><LoadOrder /></ModsManager>`,
    );

    return (await parseStringPromise(raw)) as RedDeadModsXml;
}

async function writeModsXmlData(value: RedDeadModsXml) {
    const { gameStorage } = await Manager.getContext();

    if (!gameStorage) {
        return;
    }

    const filePath = await join(gameStorage, "lml", "mods.xml");
    const data = new Builder().buildObject(value);
    await FileHandler.writeFile(filePath, data);
}

async function installXml(filePath: string, isInstall: boolean) {
    const data = await FileHandler.readFile(filePath, "");
    const xml = (await parseStringPromise(data)) as {
        EasyInstall?: {
            Name?: string[];
        };
    };
    const folderPath = await dirname(filePath);
    const name = xml.EasyInstall?.Name?.[0] ?? (await basename(folderPath));
    const folder = await basename(folderPath);

    const modsXmlData = await readModsXmlData();
    const modsManager = modsXmlData.ModsManager;
    const mods = modsManager.Mods[0] ?? (modsManager.Mods[0] = {});
    if (!mods.Mod) {
        mods.Mod = [];
    }

    let modEntry = mods.Mod.find((item) => item.$?.folder === folder);
    if (modEntry) {
        modEntry.Enabled = [isInstall];
    } else {
        modEntry = {
            $: { folder },
            Name: [name],
            Enabled: [isInstall],
            Overwrite: ["false"],
            DisabledGroups: [""],
        };
        mods.Mod.push(modEntry);
    }

    const loadOrder =
        modsManager.LoadOrder[0] ?? (modsManager.LoadOrder[0] = {});
    if (!loadOrder.Mod) {
        loadOrder.Mod = [];
    }
    if (!loadOrder.Mod.includes(folder)) {
        loadOrder.Mod.push(folder);
    }

    await writeModsXmlData(modsXmlData);
}

async function handleAsi(mod: IModInfo, isInstall: boolean) {
    const modStorage = await Manager.getModStoragePath(mod.id);

    if (!modStorage) {
        return false;
    }

    for (const item of mod.modFiles) {
        if ((await basename(item)) === "install.xml") {
            await installXml(await join(modStorage, item), isInstall);
        }
    }

    return Manager.installByFileSibling(mod, "", "asi", isInstall, true);
}

async function handleLml(
    mod: IModInfo,
    installPath: string,
    isInstall: boolean,
) {
    const modStorage = await Manager.getModStoragePath(mod.id);

    if (!modStorage) {
        return false;
    }

    const xmlFiles: string[] = [];
    for (const item of mod.modFiles) {
        if ((await basename(item)) === "install.xml") {
            xmlFiles.push(item);
        }
    }
    if (xmlFiles.length === 0) {
        ElMessage.warning("未找到 install.xml");
        return false;
    }

    for (const item of xmlFiles) {
        await installXml(await join(modStorage, item), isInstall);
        const folderName = await basename(await dirname(item));
        await Manager.installByFileSibling(
            mod,
            await join(installPath, folderName),
            "install.xml",
            isInstall,
        );
    }

    return true;
}

/**
 * @description 荒野大镖客 2 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 208,
        steamAppID: 1174180,
        nexusMods: {
            game_domain_name: "reddeadredemption2",
            game_id: 3024,
        },
        installdir: await join("Red Dead Redemption 2"),
        gameName: "Red Dead Redemption 2",
        gameExe: "RDR2.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1174180",
            },
            {
                name: "直接启动",
                exePath: "RDR2.exe",
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "Rockstar Games",
            "Red Dead Redemption 2",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/208.png",
        modType: [
            {
                id: 1,
                name: "asi",
                installPath: "",
                async install(mod) {
                    return handleAsi(mod, true);
                },
                async uninstall(mod) {
                    return handleAsi(mod, false);
                },
            },
            {
                id: 2,
                name: "lml",
                installPath: await join("lml"),
                async install(mod) {
                    return handleLml(mod, this.installPath ?? "", true);
                },
                async uninstall(mod) {
                    return handleLml(mod, this.installPath ?? "", false);
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
                id: 4,
                name: "ScriptHookRDR2",
                installPath: "",
                async install(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "ScriptHookRDR2.dll",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "ScriptHookRDR2.dll",
                        false,
                    );
                },
            },
            {
                id: 5,
                name: "script",
                installPath: await join("scripts"),
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
            let asi = false;
            let rootFolder = false;
            const folderList = ["x64"];
            let lml = false;
            let scriptHookRDR2 = false;
            let scripts = false;

            for (const item of mod.modFiles) {
                const pathParts = FileHandler.pathToArray(item);
                const extension = await FileHandler.getFileExtension(item);

                if (pathParts.some((part) => folderList.includes(part)))
                    rootFolder = true;
                if (extension === "asi") asi = true;
                if (extension === "dll") scripts = true;
                if ((await basename(item)) === "install.xml") lml = true;
                if ((await basename(item)) === "ScriptHookRDR2.dll")
                    scriptHookRDR2 = true;
            }

            if (scriptHookRDR2) return 4;
            if (asi) return 1;
            if (lml) return 2;
            if (rootFolder) return 3;
            if (scripts) return 5;

            return 99;
        },
    }) as ISupportedGames;
