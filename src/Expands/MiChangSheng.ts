import { basename, dirname, join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";

const MOD_BIN_HEX =
    "0001000000ffffffff01000000000000000c0200000046417373656d626c792d4353686172702c2056657273696f6e3d302e302e302e302c2043756c747572653d6e65757472616c2c205075626c69634b6579546f6b656e3d6e756c6c0c0300000050417373656d626c792d4353686172702d6669727374706173732c2056657273696f6e3d302e302e302e302c2043756c747572653d6e65757472616c2c205075626c69634b6579546f6b656e3d6e756c6c0501000000197363726970742e537465616d2e576f726b53686f704974656d0b0000000f5075626c697368656446696c654964055469746c650344657307537465616d494404546167730a5669736962696c697479074d6f645061746807496d67506174680a49734e6565644e6578740c446570656e64656e63696573104c617374446570656e64656e6369657304010100030001010003031c537465616d776f726b732e5075626c697368656446696c6549645f7403000000107f53797374656d2e436f6c6c656374696f6e732e47656e657269632e4c69737460315b5b53797374656d2e537472696e672c206d73636f726c69622c2056657273696f6e3d342e302e302e302c2043756c747572653d6e65757472616c2c205075626c69634b6579546f6b656e3d623737613563353631393334653038395d5d08017f53797374656d2e436f6c6c656374696f6e732e47656e657269632e4c69737460315b5b53797374656d2e55496e7436342c206d73636f726c69622c2056657273696f6e3d342e302e302e302c2043756c747572653d6e65757472616c2c205075626c69634b6579546f6b656e3d623737613563353631393334653038395d5d7f53797374656d2e436f6c6c656374696f6e732e47656e657269632e4c69737460315b5b53797374656d2e55496e7436342c206d73636f726c69622c2056657273696f6e3d342e302e302e302c2043756c747572653d6e65757472616c2c205075626c69634B6579546f6b656e3d623737613563353631393334653038395d5d0200000005fcffffff1c537465616d776f726b732e5075626c697368656446696c6549645f7401000000116d5f5075626c697368656446696c6549640010030000008db5a4b100000000060500000011476c6f7373204d6f64204d616e61676572060600000024e4bdbfe794a8206c6f7373204d6f64204d616e6167657220e5ae89e8a385e79a844d6f641d1ef00d01001001090700000002000000060800000037463a5c737465616d5c737465616d617070735c636f6d6d6f6e5ce8a785e995bfe7949f5ce69cace59cb04d6f64e6b58be8af955c476d6d060900000025453a5ce6a18ce99da25ce59bbee789875c4d4f44e7ab995c6c6f676f5c6c6f676f2e706e6701090a000000090b00000004070000007f53797374656d2e436f6c6c656374696f6e732e47656e657269632e4c69737460315b5b53797374656d2e537472696e672c206d73636f726c69622c2056657273696f6e3d342e302e302e302c2043756c747572653d6e65757472616c2c205075626c69634B6579546f6b656e3d623737613563353631393334653038395d5d03000000065f6974656d73055f73697a65085f76657273696f6e0600000808090c0000000100000001000000040a0000007f53797374656d2e436f6c6c656374696f6e732e47656e657269632e4c69737460315b5b53797374656d2e55496e7436342c206d73636f726c69622c2056657273696f6e3d342e302e302e302c2043756c747572653d6e65757472616c2c205075626c69634B6579546f6b656e3d623737613563353631393334653038395d5d03000000065f6974656d73055f73697a65085f76657273696f6e070000100808090d0000000000000001000000010b0000000a000000090d0000000000000001000000110c00000004000000060e00000006e68f92e4bbb60d030f0d00000000000000100b";

function hexToBytes(hex: string) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < hex.length; index += 2) {
        bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
    }
    return bytes;
}

async function ensureInputBin() {
    const { gameStorage } = await Manager.getContext();
    if (!gameStorage) {
        return;
    }

    const binFile = await join(gameStorage, "本地Mod测试", "Gmm", "Mod.bin");
    if (!(await FileHandler.fileExists(binFile))) {
        await FileHandler.writeFile(binFile, hexToBytes(MOD_BIN_HEX));
    }
}

async function handleLinkedFolder(
    mod: IModInfo,
    installPath: string,
    isInstall: boolean,
    rootFile: string,
) {
    await ensureInputBin();

    const modStorage = await Manager.getModStoragePath(mod.id);
    const { gameStorage } = await Manager.getContext();
    if (!modStorage || !gameStorage) {
        return [] as IState[];
    }

    const folders = new Set<string>();
    const result: IState[] = [];
    for (const item of mod.modFiles) {
        if ((await basename(item)).toLowerCase() === rootFile.toLowerCase()) {
            folders.add(await dirname(await join(modStorage, item)));
        }
    }

    for (const folderPath of folders) {
        const target = await join(
            gameStorage,
            installPath,
            await basename(folderPath),
        );
        const state = isInstall
            ? await FileHandler.createLink(folderPath, target)
            : await FileHandler.removeLink(target);
        result.push({ file: folderPath, state });
    }

    return result;
}

async function handleDllPlugins(
    mod: IModInfo,
    installPath: string,
    isInstall: boolean,
) {
    await ensureInputBin();

    const modStorage = await Manager.getModStoragePath(mod.id);
    const { gameStorage } = await Manager.getContext();
    if (!modStorage || !gameStorage) {
        return true;
    }

    for (const item of mod.modFiles) {
        if ((await FileHandler.getFileExtension(item)).toLowerCase() !== "dll") {
            continue;
        }

        const source = await join(modStorage, item);
        const target = await join(
            gameStorage,
            installPath,
            await basename(item),
        );
        if (isInstall) {
            await FileHandler.copyFile(source, target);
        } else {
            await FileHandler.deleteFile(target);
        }
    }

    return true;
}

/**
 * @description 觅长生支持
 */
export const supportedGames = async () =>
    ({
        GlossGameId: 255,
        steamAppID: 1189490,
        nexusMods: {
            game_domain_name: "MiChangSheng",
            game_id: 99999,
        },
        installdir: "觅长生",
        gameName: "MiChangSheng",
        gameExe: "觅长生.exe",
        startExe: [
            {
                name: "Steam 启动",
                cmd: "steam://rungameid/1189490",
            },
        ],
        gameCoverImg:
            "https://assets-mod.3dmgame.com/static/upload/game/60d93f98c7462.png",
        modType: [
            {
                id: 1,
                name: "bin",
                installPath: await join("本地Mod测试"),
                async install(mod) {
                    return handleLinkedFolder(
                        mod,
                        this.installPath ?? "",
                        true,
                        "mod.bin",
                    );
                },
                async uninstall(mod) {
                    return handleLinkedFolder(
                        mod,
                        this.installPath ?? "",
                        false,
                        "mod.bin",
                    );
                },
            },
            {
                id: 2,
                name: "插件",
                installPath: await join("本地Mod测试", "Gmm", "plugins"),
                async install(mod) {
                    return handleDllPlugins(mod, this.installPath ?? "", true);
                },
                async uninstall(mod) {
                    return handleDllPlugins(mod, this.installPath ?? "", false);
                },
            },
            {
                id: 3,
                name: "Next类",
                installPath: await join(
                    "本地Mod测试",
                    "Gmm",
                    "plugins",
                    "Next",
                ),
                async install(mod) {
                    return handleLinkedFolder(
                        mod,
                        this.installPath ?? "",
                        true,
                        "modconfig.json",
                    );
                },
                async uninstall(mod) {
                    return handleLinkedFolder(
                        mod,
                        this.installPath ?? "",
                        false,
                        "modconfig.json",
                    );
                },
            },
            {
                id: 4,
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
            let isBin = false;
            let isPlugin = false;
            let isNext = false;

            for (const item of mod.modFiles) {
                if ((await basename(item)).toLowerCase() === "mod.bin")
                    isBin = true;
                if ((await basename(item)).toLowerCase() === "modconfig.json")
                    isNext = true;
                if ((await FileHandler.getFileExtension(item)).toLowerCase() === "dll")
                    isPlugin = true;
            }

            if (isBin) return 1;
            if (isPlugin) return 2;
            if (isNext) return 3;

            return 4;
        },
    }) as ISupportedGames;
