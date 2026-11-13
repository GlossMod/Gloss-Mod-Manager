import { dirname, join } from "@tauri-apps/api/path";
import { Manager } from "@/lib/Manager";
import { UnrealEngine } from "@/lib/UnrealEngine";

function getGameRelativeParts(file: string): string[] | null {
    const parts: string[] = file.split(/[\\/]/u).filter(Boolean);
    if (parts.some((part) => part === ".." || part.includes(":"))) {
        return null;
    }

    const rootIndex: number = parts.findIndex((part, index) =>
        part.toLowerCase() === "projectpbz" ||
        (part.toLowerCase() === "platform" &&
            parts[index + 1]?.toLowerCase() === "steam"),
    );

    return rootIndex === -1 ? null : parts.slice(rootIndex);
}

async function handleRootMod(mod: IModInfo, isInstall: boolean): Promise<IState[]> {
    const handleFile = isInstall
        ? Manager.generalInstall
        : Manager.generalUninstall;
    const result: IState[] = [];

    for (const file of mod.modFiles) {
        const relativeParts: string[] | null = getGameRelativeParts(file);
        if (!relativeParts) {
            continue;
        }

        // 整包可能多套一层版本目录，同时包含脚本与 PAK；保留游戏内层级。
        const installPath: string = await dirname(await join(...relativeParts));
        result.push(...await handleFile({ ...mod, modFiles: [file] }, installPath));
    }

    return result.length > 0 ? result : handleFile(mod, "", true);
}

export const supportedGames = async (): Promise<ISupportedGames> => ({
    GlossGameId: 548,
    steamAppID: 4115450,
    installdir: await join("PBZ", "platform", "steam"),
    gameName: "Phantom Blade Zero",
    gameExe: [
        {
            name: "PBZ.exe",
            // EXE 位于 platform/steam，MOD 安装路径以 PBZ 根目录为基准。
            rootPath: ["..", ".."],
        },
    ],
    startExe: [
        {
            name: "Steam 启动",
            cmd: "steam://rungameid/4115450",
        },
        {
            name: "直接启动",
            exePath: await join("platform", "steam", "PBZ.exe"),
        },
    ],
    gameCoverImg:
        "https://assets-mod.3dmgame.com/static/upload/logo/croppedImg_6a8dd888a6007.png",
    modType: await Promise.all(
        (await UnrealEngine.modType("ProjectPBZ", false)).map(async (type) => {
            if (type.id === 6) {
                return {
                    ...type,
                    async install(mod: IModInfo) {
                        return handleRootMod(mod, true);
                    },
                    async uninstall(mod: IModInfo) {
                        return handleRootMod(mod, false);
                    },
                };
            }

            if (type.id === 2 || type.id === 3 || type.id === 5) {
                return {
                    ...type,
                    installPath: type.id === 2
                        ? await join("platform", "steam")
                        : await join("platform", "steam", "ue4ss", "Mods"),
                };
            }

            return type;
        }),
    ),
    async checkModType(mod) {
        if (mod.modFiles.some((file) => getGameRelativeParts(file) !== null)) {
            return 6;
        }

        return UnrealEngine.checkModType(mod);
    },
});
