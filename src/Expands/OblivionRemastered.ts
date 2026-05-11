import { basename, join } from "@tauri-apps/api/path";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";
import { UnrealEngine } from "@/lib/UnrealEngine";

/**
 * @description 上古卷轴 4：湮灭 重制版支持
 */
async function handleEsp(
    mod: IModInfo,
    installPath: string,
    isInstall: boolean,
) {
    const { gameStorage } = await Manager.getContext();

    if (!gameStorage) {
        return false;
    }

    const pluginsPath = await join(gameStorage, installPath, "Plugins.txt");
    const pluginsFile = await FileHandler.readFile(pluginsPath, "");
    const pluginsFileList = pluginsFile
        .split(/\r?\n/u)
        .map((item) => item.trim())
        .filter((item) => item !== "");
    const espFileList: string[] = [];
    for (const item of mod.modFiles) {
        if ((await FileHandler.getFileExtension(item)).toLowerCase() === "esp") {
            espFileList.push(item);
        }
    }

    if (isInstall) {
        for (const esp of espFileList) {
            const name = await basename(esp);
            if (!pluginsFileList.includes(name)) {
                pluginsFileList.push(name);
            }
        }
    } else {
        for (const esp of espFileList) {
            const name = await basename(esp);
            const index = pluginsFileList.indexOf(name);
            if (index !== -1) {
                pluginsFileList.splice(index, 1);
            }
        }
    }

    await FileHandler.writeFile(pluginsPath, pluginsFileList.join("\n"));

    return Manager.installByFileSibling(
        mod,
        installPath,
        ".esp",
        isInstall,
        true,
    );
}

export const supportedGames = async () => {
    const unrealTypes = await UnrealEngine.modType("OblivionRemastered", false);

    return {
        GlossGameId: 430,
        steamAppID: 2623190,
        nexusMods: {
            game_domain_name: "oblivionremastered",
            game_id: 7587,
        },
        installdir: await join("Oblivion Remastered"),
        gameName: "Oblivion Remastered",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/2623190",
            },
            {
                name: "直接启动",
                exePath: "OblivionRemastered.exe",
            },
        ],
        gameExe: [
            {
                name: "OblivionRemastered.exe",
                rootPath: ["."],
            },
            {
                name: "OblivionRemastered-Win64-Shipping.exe",
                rootPath: ["..", "..", ".."],
            },
            {
                name: "OblivionRemastered-WinGDK-Shipping.exe",
                rootPath: ["..", "..", ".."],
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/logo/croppedImg_68084078343d1.jpg",
        modType: [
            ...unrealTypes.filter((item) => item.id !== 6),
            {
                id: 6,
                name: "游戏根目录",
                installPath: "",
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "OblivionRemastered",
                        true,
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "OblivionRemastered",
                        false,
                        true,
                    );
                },
            },
            {
                id: 7,
                name: "Data",
                installPath: await join(
                    "OblivionRemastered",
                    "Content",
                    "Dev",
                    "ObvData",
                    "Data",
                ),
                async install(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "Data",
                        true,
                    );
                },
                async uninstall(mod) {
                    return Manager.installByFolder(
                        mod,
                        this.installPath ?? "",
                        "Data",
                        false,
                    );
                },
            },
            {
                id: 8,
                name: "esp",
                installPath: await join(
                    "OblivionRemastered",
                    "Content",
                    "Dev",
                    "ObvData",
                    "Data",
                ),
                async install(mod) {
                    return handleEsp(mod, this.installPath ?? "", true);
                },
                async uninstall(mod) {
                    return handleEsp(mod, this.installPath ?? "", false);
                },
            },
        ],
        async checkModType(mod) {
            let rootPath = false;
            let esp = false;
            let data = false;

            for (const item of mod.modFiles) {
                const pathParts = FileHandler.pathToArray(item);
                if (pathParts.includes("OblivionRemastered")) rootPath = true;
                if ((await FileHandler.getFileExtension(item)).toLowerCase() === "esp") esp = true;
                if (pathParts.includes("Data")) data = true;
            }

            if (esp) return 8;
            if (rootPath) return 6;
            if (data) return 7;

            return UnrealEngine.checkModType(mod);
        },
    } as ISupportedGames;
};
