/**
 * 导出所有扩展
 */

import {
    loadLegacyCustomGames,
    mergeLegacyCustomTypesIntoGame,
} from "@/lib/legacy-custom-data";

type ExpandModule = {
    supportedGames?: () => Promise<ISupportedGames>;
};

/**
 * 此前使用 eager glob 一次性把全部游戏扩展（约 145 个模块）打进入口 chunk，
 * 显著拖慢启动并让入口体积接近 900KB。改为懒加载，仅在首次真正需要时载入，
 * 并缓存解析结果，避免每次调用都重复 import 与重复执行 supportedGames()。
 */
const modules = import.meta.glob<ExpandModule>("./*.ts");

let internalGamesCache: ISupportedGames[] | null = null;
let internalGamesPromise: Promise<ISupportedGames[]> | null = null;

/**
 * 载入全部内置游戏扩展定义，结果仅解析一次。
 */
async function loadInternalGames(): Promise<ISupportedGames[]> {
    if (internalGamesCache) {
        return internalGamesCache;
    }

    if (internalGamesPromise) {
        return internalGamesPromise;
    }

    internalGamesPromise = (async () => {
        const loadedModules = await Promise.all(
            Object.values(modules).map((loadModule) => loadModule()),
        );

        const games = await Promise.all(
            loadedModules
                .filter((item) => typeof item.supportedGames === "function")
                .map((item) => item.supportedGames!()),
        );

        internalGamesCache = games;

        return games;
    })().finally(() => {
        internalGamesPromise = null;
    });

    return internalGamesPromise;
}

function dedupeSupportedGames(list: ISupportedGames[]) {
    const gameMap = new Map<string, ISupportedGames>();

    for (const item of list) {
        const gameKey = item.gameName.trim().toLowerCase();
        const existingGame = gameMap.get(gameKey);

        // 同名游戏会被后入项覆盖（内置 Expand 覆盖用户自定义游戏），
        // 静默丢弃会让用户配置无提示失效，这里至少输出告警便于排查。
        if (existingGame) {
            console.warn(
                `检测到重复的游戏名称，已使用后加载的定义覆盖：${item.gameName}`,
            );
        }

        gameMap.set(gameKey, item);
    }

    return [...gameMap.values()];
}

export async function getAllExpands(): Promise<ISupportedGames[]> {
    // 内置定义可以复用缓存，但自定义类型/游戏来自用户数据，每次都要重新合并。
    const internalGames = await loadInternalGames();
    const mergedInternalGames = await Promise.all(
        internalGames.map((item) => mergeLegacyCustomTypesIntoGame(item)),
    );
    const legacyCustomGames = await loadLegacyCustomGames();

    return dedupeSupportedGames([...legacyCustomGames, ...mergedInternalGames]);
}
