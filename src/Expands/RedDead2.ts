import { basename, dirname, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

function parseXmlDocument(raw: string) {
    const document = new DOMParser().parseFromString(raw, "application/xml");
    const parserError = document.querySelector("parsererror");

    if (parserError) {
        throw new Error(parserError.textContent?.trim() || "XML 解析失败。");
    }

    return document;
}

function ensureChildElement(parent: Element, tagName: string) {
    const existingChild = Array.from(parent.children).find((item) => {
        return item.tagName === tagName;
    });

    if (existingChild) {
        return existingChild;
    }

    const child = parent.ownerDocument.createElement(tagName);
    parent.appendChild(child);
    return child;
}

function setChildText(parent: Element, tagName: string, value: string) {
    const child = ensureChildElement(parent, tagName);
    child.textContent = value;
    return child;
}

function serializeXmlDocument(document: XMLDocument) {
    const content = new XMLSerializer().serializeToString(document);

    return `<?xml version="1.0" encoding="UTF-8"?>\n${content}`;
}

async function readModsXmlDocument(): Promise<XMLDocument> {
    const { gameStorage } = await Manager.getContext();

    if (!gameStorage) {
        return parseXmlDocument(
            `<ModsManager><Mods /><LoadOrder /></ModsManager>`,
        );
    }

    const filePath = await join(gameStorage, "lml", "mods.xml");
    const raw = await FileHandler.readFile(
        filePath,
        `<ModsManager><Mods /><LoadOrder /></ModsManager>`,
    );

    return parseXmlDocument(raw);
}

async function writeModsXmlDocument(document: XMLDocument) {
    const { gameStorage } = await Manager.getContext();

    if (!gameStorage) {
        return;
    }

    const filePath = await join(gameStorage, "lml", "mods.xml");
    const data = serializeXmlDocument(document);
    await FileHandler.writeFile(filePath, data);
}

async function installXml(filePath: string, isInstall: boolean) {
    const data = await FileHandler.readFile(filePath, "");
    const xml = parseXmlDocument(data);
    const folderPath = await dirname(filePath);
    const name =
        xml.querySelector("EasyInstall > Name")?.textContent?.trim() ||
        (await basename(folderPath));
    const folder = await basename(folderPath);

    const modsXmlDocument = await readModsXmlDocument();
    const modsManager = modsXmlDocument.documentElement;
    const mods = ensureChildElement(modsManager, "Mods");
    let modEntry = Array.from(mods.children).find((item) => {
        return item.tagName === "Mod" && item.getAttribute("folder") === folder;
    });

    if (modEntry) {
        setChildText(modEntry, "Enabled", String(isInstall));
    } else {
        modEntry = modsXmlDocument.createElement("Mod");
        modEntry.setAttribute("folder", folder);
        setChildText(modEntry, "Name", name);
        setChildText(modEntry, "Enabled", String(isInstall));
        setChildText(modEntry, "Overwrite", "false");
        setChildText(modEntry, "DisabledGroups", "");
        mods.appendChild(modEntry);
    }

    const loadOrder = ensureChildElement(modsManager, "LoadOrder");
    const hasLoadOrder = Array.from(loadOrder.children).some((item) => {
        return item.tagName === "Mod" && item.textContent?.trim() === folder;
    });

    if (!hasLoadOrder) {
        const loadOrderItem = modsXmlDocument.createElement("Mod");
        loadOrderItem.textContent = folder;
        loadOrder.appendChild(loadOrderItem);
    }

    await writeModsXmlDocument(modsXmlDocument);
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
        const xmlPath = await join(modStorage, item);
        await installXml(xmlPath, isInstall);
        const folderName = await basename(await dirname(xmlPath));
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
