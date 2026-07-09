// /**
//  * @description 古墓丽影 暗影 支持
//  */
// import { Manager } from "@/lib/Manager";
// import { join, extname } from "@tauri-apps/api/path";
// import { ElMessage } from "element-plus-message";

// export const supportedGames = async () =>
//     ({
//         GlossGameId: 165,
//         steamAppID: 750920,
//         nexusMods: {
//             game_domain_name: "shadowofthetombraider",
//             game_id: 2588,
//         },
//         installdir: await join("Shadow of the Tomb Raider"),
//         gameName: "Shadow of the Tomb Raider",
//         startExe: [
//             {
//                 name: "Steam 启动",
//                 cmd: "steam://rungameid/750920",
//             },
//             {
//                 name: "直接启动",
//                 exePath: "SOTTR.exe",
//             },
//         ],
//         gameExe: "SOTTR.exe",
//         gameCoverImg:
//             "https://assets-mod.3dmgame.com/static/upload/game/165.png",
//         modType: [
//             {
//                 id: 1,
//                 name: "forger2",
//                 installPath: await join("ForgerPatches"),
//                 async install(mod) {
//                     return Manager.installByFileSibling(
//                         mod,
//                         this.installPath,
//                         ".forger2",
//                         true,
//                         true,
//                     );
//                 },
//                 async uninstall(mod) {
//                     return Manager.installByFileSibling(
//                         mod,
//                         this.installPath,
//                         ".forger2",
//                         false,
//                         true,
//                     );
//                 },
//             },
//             {
//                 id: 2,
//                 name: "游戏根目录",
//                 installPath: await join(""),
//                 async install(mod) {
//                     return Manager.generalInstall(mod, this.installPath, true);
//                 },
//                 async uninstall(mod) {
//                     return Manager.generalUninstall(
//                         mod,
//                         this.installPath,
//                         true,
//                     );
//                 },
//             },
//             {
//                 id: 99,
//                 name: "未知",
//                 installPath: "",
//                 async install(_mod) {
//                     ElMessage.warning(
//                         "该mod类型未知, 无法自动安装, 请手动安装!",
//                     );
//                     return false;
//                 },
//                 async uninstall(_mod) {
//                     return true;
//                 },
//             },
//         ],
//         async checkModType(mod) {
//             let forger2 = false;
//             let gameRoot = false;

//             const gameRootList = [".dll", ".ini", ".exe"];

//             mod.modFiles.forEach(async (file) => {
//                 if ((await extname(file)) === ".forger2") {
//                     forger2 = true;
//                 }
//                 if (gameRootList.includes(await extname(file))) {
//                     gameRoot = true;
//                 }
//             });

//             if (forger2) return 1;
//             if (gameRoot) return 2;

//             return 99;
//         },
//     }) as ISupportedGames;
