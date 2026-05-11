import { join } from "@tauri-apps/api/path";
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

async function getNextPakName() {
    const { gameStorage } = await Manager.getContext();
    if (!gameStorage) {
        return "data2";
    }

    const dataFolder = await join(gameStorage, "ph", "source");
    const pakFiles = (await FileHandler.getFolderFiles(dataFolder)).filter(
        async (item) => (await FileHandler.getFileExtension(item)).toLowerCase() === "pak",
    );
    const numbers = pakFiles.map((item) => {
        const matched = item.match(/data(\d+)/iu);
        return matched ? Number(matched[1]) : 0;
    });
    const maxNumber = Math.max(1, ...numbers);
    return `data${String(maxNumber + 1)}`;
}

async function handlePak(mod: IModInfo, isInstall: boolean) {
    const modStorage = await Manager.getModStoragePath(mod.id);
    const { gameStorage } = await Manager.getContext();

    if (!modStorage || !gameStorage) {
        return false;
    }

    let pakList = await readPakList();

    for (const item of mod.modFiles) {
        const source = await join(modStorage, item);
        if (
            !(await FileHandler.isFile(source)) ||
            (await FileHandler.getFileExtension(source)).toLowerCase() !== "pak"
        ) {
            continue;
        }

        if (isInstall) {
            const pakName = `${await getNextPakName()}.pak`;
            await FileHandler.copyFile(
                source,
                await join(gameStorage, "ph", "source", pakName),
            );
            pakList.push([
                String(mod.id),
                item.split("/").pop() ?? item,
                pakName,
            ]);
            continue;
        }

        const matched = await pakList.find(
            async (record) =>
                record[0] === String(mod.id) &&
                (await FileHandler.getFileExtension(record[1])).toLowerCase() ===
                    (await FileHandler.getFileExtension(source)).toLowerCase(),
        );
        if (!matched) {
            continue;
        }

        pakList = pakList.filter((record) => record !== matched);
        await FileHandler.deleteFile(
            await join(gameStorage, "ph", "source", matched[2]),
        );
    }

    if (!isInstall) {
        pakList.sort((left, right) => {
            const leftNumber = Number(
                left[2].replace("data", "").replace(".pak", ""),
            );
            const rightNumber = Number(
                right[2].replace("data", "").replace(".pak", ""),
            );
            return leftNumber - rightNumber;
        });

        let expectedNumber = 2;
        for (const item of pakList) {
            const currentNumber = Number(
                item[2].replace("data", "").replace(".pak", ""),
            );
            if (currentNumber !== expectedNumber) {
                const fileName = `data${String(expectedNumber)}.pak`;
                await FileHandler.renameFile(
                    await join(gameStorage, "ph", "source", item[2]),
                    await join(gameStorage, "ph", "source", fileName),
                );
                item[2] = fileName;
            }
            expectedNumber += 1;
        }
    }

    await writePakList(pakList);
    return true;
}

/**
 * @description 消逝的光芒 2 支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 272,
        steamAppID: 534380,
        nexusMods: {
            game_domain_name: "dyinglight2",
            game_id: 4302,
        },
        installdir: await join("Dying Light 2", "ph", "work", "bin", "x64"),
        gameName: "Dying Light 2",
        gameExe: [
            {
                name: "DyingLightGame_x64_rwdi.exe",
                rootPath: ["..", "..", "..", ".."],
            },
        ],
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/534380",
            },
            {
                name: "直接启动",
                exePath: await join(
                    "ph",
                    "work",
                    "bin",
                    "x64",
                    "DyingLightGame_x64_rwdi.exe",
                ),
            },
        ],
        archivePath: await join(
            await FileHandler.getMyDocuments(),
            "dying light 2",
            "out",
        ),
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/61dbf5a660a03.png",
        modType: [
            {
                id: 1,
                name: "dat",
                installPath: await join("ph", "source"),
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
                if ((await FileHandler.getFileExtension(item)).toLowerCase() === "pak") {
                    return 1;
                }
            }

            return 99;
        },
    }) as ISupportedGames;
