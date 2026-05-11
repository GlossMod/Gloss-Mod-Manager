import { basename, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

type PakRecord = [string, string, string];

export class REEngine {
    private static extractPatchNumber(fileName: string) {
        const matched = fileName.match(/patch_(\d+)\.pak$/iu);

        if (!matched) {
            return 0;
        }

        return Number(matched[1]) || 0;
    }

    private static async getPakListPath() {
        const { modStorage } = await Manager.getContext();

        if (!modStorage) {
            return "";
        }

        return await join(modStorage, "pakList.txt");
    }

    private static async readPakList(): Promise<PakRecord[]> {
        const pakListPath = await REEngine.getPakListPath();

        if (!pakListPath) {
            return [];
        }

        const raw = await FileHandler.readFile(pakListPath, "");

        return raw
            .split(/\r?\n/iu)
            .map((line) => line.trim())
            .filter((line) => line !== "")
            .map((line) => line.split("|").slice(0, 3) as PakRecord)
            .filter((line) => line.length === 3);
    }

    private static async writePakList(list: PakRecord[]) {
        const pakListPath = await REEngine.getPakListPath();

        if (!pakListPath) {
            return;
        }

        const data = list.map((item) => item.join("|")).join("\n");
        await FileHandler.writeFile(pakListPath, data);
    }

    private static async getGamePakName() {
        const { gameStorage } = await Manager.getContext();

        if (!gameStorage) {
            ElMessage.warning("未设置游戏目录，无法处理 RE Engine pak 安装。");
            return "";
        }

        const pakFiles = await FileHandler.getFolderFiles(
            gameStorage,
            true,
            false,
        );
        const patchNumbers: number[] = [];

        for (const filePath of pakFiles) {
            if ((await FileHandler.getFileExtension(filePath)).toLowerCase() !== "pak") {
                continue;
            }

            patchNumbers.push(
                REEngine.extractPatchNumber(await basename(filePath)),
            );
        }

        const nextPatch = Math.max(0, ...patchNumbers) + 1;

        return `re_chunk_000.pak.patch_${String(nextPatch).padStart(3, "0")}.pak`;
    }

    private static async normalizePakOrder(
        gameStorage: string,
        pakList: PakRecord[],
    ) {
        const sortedList = [...pakList].sort(
            (left, right) =>
                REEngine.extractPatchNumber(left[2]) -
                REEngine.extractPatchNumber(right[2]),
        );

        for (const [index, record] of sortedList.entries()) {
            const expectedName = `re_chunk_000.pak.patch_${String(index + 1).padStart(3, "0")}.pak`;

            if (record[2] === expectedName) {
                continue;
            }

            const currentPath = await join(gameStorage, record[2]);
            const expectedPath = await join(gameStorage, expectedName);

            if (!(await FileHandler.fileExists(currentPath))) {
                record[2] = expectedName;
                continue;
            }

            await FileHandler.renameFile(currentPath, expectedPath);
            record[2] = expectedName;
        }

        return sortedList;
    }

    private static async getInstallContext(mod: IModInfo) {
        const modStorage = await Manager.getModStoragePath(mod.id);
        const { gameStorage } = await Manager.getContext();

        if (!modStorage || !gameStorage) {
            ElMessage.warning(
                "未设置 Mod 储存目录或游戏目录，无法处理 RE Engine 安装。",
            );
            return null;
        }

        return {
            modStorage,
            gameStorage,
        };
    }

    public static async handlePak(mod: IModInfo, isInstall: boolean) {
        const context = await REEngine.getInstallContext(mod);

        if (!context) {
            return false;
        }

        const { modStorage, gameStorage } = context;
        let pakList = await REEngine.readPakList();

        for (const item of mod.modFiles) {
            const sourcePath = await join(modStorage, item);

            if (!(await FileHandler.isFile(sourcePath))) {
                continue;
            }

            if ((await FileHandler.getFileExtension(sourcePath)).toLowerCase() !== "pak") {
                continue;
            }

            const sourceName = await basename(sourcePath);

            if (isInstall) {
                const pakName = await REEngine.getGamePakName();

                if (!pakName) {
                    return false;
                }

                await FileHandler.copyFile(
                    sourcePath,
                    await join(gameStorage, pakName),
                );
                pakList.push([String(mod.id), sourceName, pakName]);
                continue;
            }

            const matchedIndex = pakList.findIndex(
                ([modId, fileName]) =>
                    modId === String(mod.id) && fileName === sourceName,
            );

            if (matchedIndex === -1) {
                continue;
            }

            const [, , pakName] = pakList[matchedIndex];
            await FileHandler.deleteFile(await join(gameStorage, pakName));
            pakList.splice(matchedIndex, 1);
        }

        pakList = await REEngine.normalizePakOrder(gameStorage, pakList);
        await REEngine.writePakList(pakList);

        return true;
    }

    public static async modType(): Promise<ISupportedGames["modType"]> {
        return [
            {
                id: 1,
                name: "autorun",
                installPath: await join("reframework", "autorun"),
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "autorun",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "autorun",
                        false,
                    );
                },
            },
            {
                id: 2,
                name: "REFramework",
                installPath: "",
                async install(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "dinput8.dll",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFileSibling(
                        mod,
                        this.installPath ?? "",
                        "dinput8.dll",
                        false,
                    );
                },
            },
            {
                id: 3,
                name: "模型替换",
                installPath: await join("natives"),
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "natives",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "natives",
                        false,
                    );
                },
            },
            {
                id: 4,
                name: "plugins",
                installPath: await join("reframework", "plugins"),
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "plugins",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "plugins",
                        false,
                    );
                },
            },
            {
                id: 5,
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
                id: 6,
                name: "pak",
                installPath: "",
                async install(mod) {
                    return REEngine.handlePak(mod, true);
                },
                async uninstall(mod) {
                    return REEngine.handlePak(mod, false);
                },
            },
            {
                id: 7,
                name: "RefPubgins",
                installPath: await join("reframework"),
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "reframework",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "reframework",
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
    }

    public static async checkModType(mod: IModInfo) {
        let natives = false;
        let plugins = false;
        let autorun = false;
        let reFramework = false;
        let pak = false;
        let refPlugins = false;

        for (const item of mod.modFiles) {
            const fileName = (await basename(item)).toLowerCase();
            const pathParts = FileHandler.pathToArray(item).map((part) =>
                part.toLowerCase(),
            );

            if (fileName === "dinput8.dll") {
                reFramework = true;
            }

            if (pathParts.includes("natives")) {
                natives = true;
            }

            if (pathParts.includes("autorun")) {
                autorun = true;
            }

            if (pathParts.includes("plugins")) {
                plugins = true;
            }

            if (pathParts.includes("reframework")) {
                refPlugins = true;
            }

            if ((await FileHandler.getFileExtension(item)).toLowerCase() === "pak") {
                pak = true;
            }
        }

        if (reFramework) return 2;
        if (refPlugins) return 7;
        if (autorun) return 1;
        if (plugins) return 4;
        if (natives) return 3;
        if (pak) return 6;

        return 99;
    }
}
