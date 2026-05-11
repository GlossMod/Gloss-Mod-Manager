import { basename, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { DotNetTool } from "../lib/dotnet-tool";
import { FileHandler } from "../lib/FileHandler";
import { Manager } from "../lib/Manager";

interface IBg3ModuleAttribute {
    id: string;
    type: string;
    value: string;
}

const BG3_TOOL_WEB_ID = 200783;
const BG3_TOOL_FILE_NAME = "BaldursGate3.dll";

const DEFAULT_MODSETTINGS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<save>
    <version major="4" minor="0" revision="9" build="331" />
    <region id="ModuleSettings">
        <node id="root">
            <children>
                <node id="ModOrder">
                    <children />
                </node>
                <node id="Mods">
                    <children />
                </node>
            </children>
        </node>
    </region>
</save>`;

function parseXmlDocument(xmlContent: string, context: string) {
    const document = new DOMParser().parseFromString(
        xmlContent,
        "application/xml",
    );

    if (document.querySelector("parsererror")) {
        throw new Error(`${context} 解析失败。`);
    }

    return document;
}

function serializeXmlDocument(document: XMLDocument | Document) {
    const xmlBody = new XMLSerializer().serializeToString(document);
    return xmlBody.startsWith("<?xml")
        ? xmlBody
        : `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBody}`;
}

function findNodeElementById(parent: Document | Element, nodeId: string) {
    return Array.from(parent.getElementsByTagName("node")).find(
        (item) => item.getAttribute("id") === nodeId,
    );
}

function findAttributeElementById(parent: Element, attributeId: string) {
    return Array.from(parent.children).find((item) => {
        return (
            item.tagName === "attribute" &&
            item.getAttribute("id") === attributeId
        );
    });
}

function ensureChildrenElement(document: Document, parent: Element) {
    const current = Array.from(parent.children).find(
        (item) => item.tagName === "children",
    );

    if (current) {
        return current;
    }

    const childrenElement = document.createElement("children");
    parent.appendChild(childrenElement);
    return childrenElement;
}

function createNodeElement(document: Document, nodeId: string) {
    const nodeElement = document.createElement("node");
    nodeElement.setAttribute("id", nodeId);
    nodeElement.appendChild(document.createElement("children"));
    return nodeElement;
}

function ensureModsNode(document: Document) {
    const saveElement = document.documentElement;
    let regionElement = Array.from(
        saveElement.getElementsByTagName("region"),
    ).find((item) => item.getAttribute("id") === "ModuleSettings");

    if (!regionElement) {
        regionElement = document.createElement("region");
        regionElement.setAttribute("id", "ModuleSettings");
        saveElement.appendChild(regionElement);
    }

    let rootNode = findNodeElementById(regionElement, "root");

    if (!rootNode) {
        rootNode = createNodeElement(document, "root");
        regionElement.appendChild(rootNode);
    }

    const rootChildren = ensureChildrenElement(document, rootNode);
    let modsNode = Array.from(rootChildren.children).find((item) => {
        return item.tagName === "node" && item.getAttribute("id") === "Mods";
    });

    if (!modsNode) {
        modsNode = createNodeElement(document, "Mods");
        rootChildren.appendChild(modsNode);
    }

    return modsNode;
}

function removeModuleShortDescNodeByUuid(modsChildren: Element, uuid: string) {
    let removed = false;

    for (const nodeElement of Array.from(modsChildren.children)) {
        if (
            nodeElement.tagName !== "node" ||
            nodeElement.getAttribute("id") !== "ModuleShortDesc"
        ) {
            continue;
        }

        const uuidElement = findAttributeElementById(nodeElement, "UUID");

        if (uuidElement?.getAttribute("value") !== uuid) {
            continue;
        }

        nodeElement.remove();
        removed = true;
    }

    return removed;
}

function appendModuleShortDescNode(
    document: Document,
    modsChildren: Element,
    attributes: IBg3ModuleAttribute[],
) {
    const nodeElement = document.createElement("node");
    nodeElement.setAttribute("id", "ModuleShortDesc");

    for (const attribute of attributes) {
        const attributeElement = document.createElement("attribute");
        attributeElement.setAttribute("id", attribute.id);
        attributeElement.setAttribute("type", attribute.type);
        attributeElement.setAttribute("value", attribute.value);
        nodeElement.appendChild(attributeElement);
    }

    modsChildren.appendChild(nodeElement);
}

async function getBg3ToolAssemblyPath() {
    const assemblyPath = await DotNetTool.resolveManagedToolPath(
        BG3_TOOL_FILE_NAME,
        BG3_TOOL_WEB_ID,
    );

    if (!assemblyPath) {
        ElMessage.warning(
            "未找到博德之门3前置工具，请先在当前游戏管理器中安装该前置。",
        );
        return "";
    }

    return assemblyPath;
}

async function getModsettingsPath() {
    return await join(
        await FileHandler.GetAppData(),
        "Local",
        "Larian Studios",
        "Baldur's Gate 3",
        "PlayerProfiles",
        "Public",
        "modsettings.lsx",
    );
}

async function loadModsettingsDocument() {
    const modsettingsPath = await getModsettingsPath();
    const xmlContent = await FileHandler.readFile(
        modsettingsPath,
        DEFAULT_MODSETTINGS_XML,
    );

    return {
        modsettingsPath,
        document: parseXmlDocument(xmlContent, "modsettings.lsx"),
    };
}

async function loadModDataFromPak(assemblyPath: string, pakPath: string) {
    const xmlContent = await DotNetTool.invoke<string>({
        assemblyPath,
        typeName: "BaldursGate3.Program",
        methodName: "LoadModDataFromPakAsync",
        payload: pakPath,
    });

    if (!xmlContent) {
        return [] as IBg3ModuleAttribute[];
    }

    const xmlDocument = parseXmlDocument(xmlContent, "博德之门3 pak 元数据");
    const moduleInfoNode = findNodeElementById(xmlDocument, "ModuleInfo");

    if (!moduleInfoNode) {
        return [] as IBg3ModuleAttribute[];
    }

    return Array.from(moduleInfoNode.children)
        .filter((item) => item.tagName === "attribute")
        .map((item) => ({
            id: item.getAttribute("id") ?? "",
            type: item.getAttribute("type") ?? "",
            value: item.getAttribute("value") ?? "",
        }))
        .filter((item) => item.id && item.type);
}

async function handlePak(
    mod: IModInfo,
    installPath: string,
    isInstall: boolean,
) {
    const assemblyPath = await getBg3ToolAssemblyPath();
    const modStorage = await Manager.getModStoragePath(mod.id);

    if (!assemblyPath || !modStorage) {
        return false;
    }

    const { modsettingsPath, document } = await loadModsettingsDocument();
    const modsNode = ensureModsNode(document);
    const modsChildren = ensureChildrenElement(document, modsNode);
    let hasChanges = false;

    for (const item of mod.modFiles) {
        if (
            (await FileHandler.getFileExtension(item)).toLowerCase() !== "pak"
        ) {
            continue;
        }

        const sourcePath = await join(modStorage, item);

        if (!(await FileHandler.isFile(sourcePath))) {
            continue;
        }

        const targetPath = await join(installPath, await basename(item));

        if (isInstall) {
            await FileHandler.copyFile(sourcePath, targetPath);
        } else {
            await FileHandler.deleteFile(targetPath);
        }

        const metadata = await loadModDataFromPak(assemblyPath, sourcePath);
        const moduleShortDesc = metadata.filter((attribute) => {
            return [
                "Folder",
                "MD5",
                "Name",
                "UUID",
                "Version64",
                "PublishHandle",
            ].includes(attribute.id);
        });
        const uuid = moduleShortDesc.find(
            (attribute) => attribute.id === "UUID",
        )?.value;

        if (!uuid) {
            continue;
        }

        if (removeModuleShortDescNodeByUuid(modsChildren, uuid)) {
            hasChanges = true;
        }

        if (isInstall && moduleShortDesc.length > 0) {
            appendModuleShortDescNode(document, modsChildren, moduleShortDesc);
            hasChanges = true;
        }
    }

    if (hasChanges) {
        await FileHandler.writeFile(
            modsettingsPath,
            serializeXmlDocument(document),
        );
    }

    return true;
}

export const supportedGames = async () =>
    ({
        GlossGameId: 240,
        steamAppID: 1086940,
        mod_io: 6715,
        nexusMods: {
            game_domain_name: "baldursgate3",
            game_id: 3474,
        },
        installdir: await join("Baldurs Gate 3", "bin"),
        gameName: "Baldurs Gate 3",
        gameExe: [
            {
                name: "bg3.exe",
                rootPath: [".."],
            },
            {
                name: "bg3_dx11.exe",
                rootPath: [".."],
            },
        ],
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1086940",
            },
            {
                name: "Vulkan",
                exePath: await join("bin", "bg3.exe"),
            },
            {
                name: "DirectX 11",
                exePath: await join("bin", "bg3_dx11.exe"),
            },
        ],
        archivePath: await join(
            await FileHandler.GetAppData(),
            "Local",
            "Larian Studios",
            "Baldur's Gate 3",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/5f9fc80ea912c.png",
        modType: [
            {
                id: 1,
                name: "pak",
                installPath: await join(
                    await FileHandler.GetAppData(),
                    "Local",
                    "Larian Studios",
                    "Baldur's Gate 3",
                    "Mods",
                ),
                async install(mod) {
                    try {
                        return handlePak(mod, this.installPath ?? "", true);
                    } catch (error) {
                        ElMessage.error(`错误: ${error}`);
                        return false;
                    }
                },
                async uninstall(mod) {
                    return handlePak(mod, this.installPath ?? "", false);
                },
            },
            {
                id: 2,
                name: "Data",
                installPath: await join("Data"),
                async install(mod) {
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
                name: "插件",
                installPath: "",
                async install(mod) {
                    if (String(mod.webId ?? "") === "201398") {
                        return Manager.generalInstall(
                            mod,
                            this.installPath ?? "",
                            true,
                        );
                    }

                    return true;
                },
                async uninstall(mod) {
                    if (String(mod.webId ?? "") === "201398") {
                        return Manager.generalUninstall(
                            mod,
                            this.installPath ?? "",
                            true,
                        );
                    }

                    return true;
                },
            },
            {
                id: 4,
                name: "NativeMods",
                installPath: await join("bin", "NativeMods"),
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "NativeMods",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "NativeMods",
                        false,
                    );
                },
            },
            {
                id: 5,
                name: "bin",
                installPath: await join("bin"),
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "bin",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "bin",
                        false,
                    );
                },
            },
            {
                id: 6,
                name: "bg3se",
                installPath: await join("bin"),
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
        ],
        async checkModType(mod) {
            if (["200783", "201398"].includes(String(mod.webId ?? ""))) {
                return 3;
            }

            let pak = false;
            let data = false;
            let nativeMods = false;
            let bin = false;
            let bg3se = false;

            for (const item of mod.modFiles) {
                const lowerItem = item.toLowerCase();

                if (
                    (await FileHandler.getFileExtension(item)).toLowerCase() ===
                    "pak"
                )
                    pak = true;
                if (lowerItem.includes("public") || lowerItem.includes("data"))
                    data = true;
                if (lowerItem.includes("bin")) bin = true;
                if (
                    (await FileHandler.getFileExtension(item)).toLowerCase() ===
                    "dll"
                )
                    nativeMods = true;
                if ((await basename(item)).toLowerCase() === "dwrite.dll")
                    bg3se = true;
            }

            if (bg3se) return 6;
            if (pak) return 1;
            if (data) return 2;
            if (bin) return 5;
            if (nativeMods) return 4;

            return 99;
        },
    }) as ISupportedGames;
