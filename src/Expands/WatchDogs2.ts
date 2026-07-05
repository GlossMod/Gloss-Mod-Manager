import { basename, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

type PakRecord = [string, string, string];

async function getPakListPath() {
    const { modStorage } = await Manager.getContext();
    return modStorage ? await join(modStorage, "pakList.txt") : "";
}

async function readPakList(): Promise<PakRecord[]> {
    const filePath = await getPakListPath();
    if (!filePath) {
        return [];
    }

    const raw = await FileHandler.readFile(filePath, "");
    return raw
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .map((line) => line.split("|").slice(0, 3) as PakRecord);
}

async function writePakList(list: PakRecord[]) {
    const filePath = await getPakListPath();
    if (!filePath) {
        return;
    }

    await FileHandler.writeFile(
        filePath,
        list.map((item) => item.join("|")).join("\n"),
    );
}

async function getNextPatchName(increment: boolean) {
    const { gameStorage } = await Manager.getContext();
    if (!gameStorage) {
        return "patch0";
    }

    const dataFolder = await join(gameStorage, "data_win64");
    const datFiles: string[] = [];
    for (const item of await FileHandler.getFolderFiles(dataFolder)) {
        if (
            (await FileHandler.getFileExtension(item)).toLowerCase() === "dat"
        ) {
            datFiles.push(item);
        }
    }
    const numbers = datFiles.map((item) => {
        const matched = item.match(/patch(\d+)/iu);
        return matched ? Number(matched[1]) : 0;
    });
    let maxNumber = Math.max(0, ...numbers);
    if (increment) {
        maxNumber += 1;
    }
    return `patch${maxNumber}`;
}

async function handlePak(mod: IModInfo, isInstall: boolean) {
    const modStorage = await Manager.getModStoragePath(mod.id);
    const { gameStorage } = await Manager.getContext();

    if (!modStorage || !gameStorage) {
        return false;
    }

    let pakList = await readPakList();
    const patchMap = new Map<string, string>();
    const files: Array<{ item: string; extension: string; stem: string }> = [];
    for (const item of mod.modFiles) {
        const extension = await FileHandler.getFileExtension(item);
        if (extension !== "dat" && extension !== "fat") {
            continue;
        }

        const fileName = await basename(item);

        files.push({
            item,
            extension,
            stem: fileName.slice(0, -(extension.length + 1)),
        });
    }
    files.sort((left, right) => {
        if (left.stem === right.stem) {
            if (left.extension === right.extension) {
                return 0;
            }
            return left.extension === "dat" ? -1 : 1;
        }
        return left.stem.localeCompare(right.stem);
    });

    for (const file of files) {
        const source = await join(modStorage, file.item);
        const extension = file.extension;
        if (!(await FileHandler.isFile(source))) {
            continue;
        }

        if (isInstall) {
            const stem = file.stem;
            const patchName =
                patchMap.get(stem) ||
                (await getNextPatchName(extension === "dat"));
            patchMap.set(stem, patchName);
            const gameFileName = `${patchName}.${extension}`;
            await FileHandler.copyFile(
                source,
                await join(gameStorage, "data_win64", gameFileName),
            );
            pakList.push([
                String(mod.id),
                await basename(source),
                gameFileName,
            ]);
            continue;
        }

        let matched: PakRecord | undefined;
        for (const record of pakList) {
            if (record[0] !== String(mod.id)) {
                continue;
            }

            if ((await FileHandler.getFileExtension(record[1])) === extension) {
                matched = record;
                break;
            }
        }
        if (!matched) {
            continue;
        }

        pakList = pakList.filter((record) => record !== matched);
        await FileHandler.deleteFile(
            await join(gameStorage, "data_win64", matched[2]),
        );
    }

    await writePakList(pakList);
    return true;
}

/**
 * @description 看门狗 2 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 176,
        steamAppID: 447040,
        nexusMods: {
            game_domain_name: "watchdogs2",
            game_id: 2454,
        },
        installdir: await join("Watch_Dogs2"),
        gameName: "Watch Dogs 2",
        gameExe: "EAC.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/447040",
            },
            {
                name: "直接启动",
                exePath: "EAC.exe",
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/176.jpg",
        modType: [
            {
                id: 1,
                name: "dat",
                installPath: await join("data_win64"),
                async install(mod) {
                    return handlePak(mod, true);
                },
                async uninstall(mod) {
                    return handlePak(mod, false);
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
            for (const item of mod.modFiles) {
                if (
                    (await FileHandler.getFileExtension(item)).toLowerCase() ===
                    "dat"
                ) {
                    return 1;
                }
            }

            return 99;
        },
    }) as ISupportedGames;
