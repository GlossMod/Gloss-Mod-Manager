import { describe, expect, it } from "vitest";
import { computed, nextTick, ref, watch } from "vue";

/**
 * 复现「从详情页返回游览页时跳回第一页」的问题。
 *
 * managerGame 由持久化存储异步注水，首帧是 null。这里用同样的时序模拟：
 * 组件先按 query 恢复出页码，随后注水把当前游戏由 null 补成真实值。
 * 修复前该变化会被当成用户切换游戏而重置页码，修复后应保留恢复出来的页码。
 */
function createExploreState(restoredPage: number, followGame = true) {
    const page = ref(restoredPage);
    const followCurrentGame = ref(followGame);
    const managerGame = ref<{ GlossGameId: number } | null>(null);
    const managedGameId = computed(() => managerGame.value?.GlossGameId ?? null);
    const fetchedPages: number[] = [];

    watch(managedGameId, (_gameId, previousGameId) => {
        if (!followCurrentGame.value) {
            return;
        }

        // null -> 游戏 属于注水，不是用户切换游戏，不能重置页码。
        if (previousGameId === null) {
            fetchedPages.push(page.value);
            return;
        }

        if (page.value !== 1) {
            page.value = 1;
            return;
        }

        fetchedPages.push(page.value);
    });

    watch(page, () => {
        fetchedPages.push(page.value);
    });

    return { page, managerGame, followCurrentGame, fetchedPages };
}

describe("游览页从详情返回后的分页恢复", () => {
    it("持久化注水补上当前游戏时保留 query 恢复出来的页码", async () => {
        const state = createExploreState(5);

        // 模拟持久化注水
        state.managerGame.value = { GlossGameId: 42 };
        await nextTick();

        expect(state.page.value).toBe(5);
        expect(state.fetchedPages).toEqual([5]);
    });

    it("用户真正切换游戏时仍然回到第一页", async () => {
        const state = createExploreState(5);

        state.managerGame.value = { GlossGameId: 42 };
        await nextTick();

        // 用户切换到另一个游戏
        state.managerGame.value = { GlossGameId: 99 };
        await nextTick();

        expect(state.page.value).toBe(1);
        expect(state.fetchedPages).toEqual([5, 1]);
    });

    it("恢复页码本身就是第一页时不会重复请求", async () => {
        const state = createExploreState(1);

        state.managerGame.value = { GlossGameId: 42 };
        await nextTick();

        expect(state.page.value).toBe(1);
        expect(state.fetchedPages).toEqual([1]);
    });

    it("不跟随当前游戏时，游戏变化不触发请求也不重置页码", async () => {
        const state = createExploreState(5, false);

        state.managerGame.value = { GlossGameId: 42 };
        await nextTick();

        expect(state.page.value).toBe(5);
        expect(state.fetchedPages).toEqual([]);
    });
});
