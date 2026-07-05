import type { CrowdfundingGamesResponse } from "../../../src/lib/game-crowdfunding";
import { listCrowdfundingGames } from "../../utils/game-crowdfunding";

export default defineEventHandler(async (event) => {
    setHeader(
        event,
        "cache-control",
        "s-maxage=300, stale-while-revalidate=600",
    );

    const response: CrowdfundingGamesResponse = {
        games: await listCrowdfundingGames(),
        generatedAt: new Date().toISOString(),
    };

    return response;
});
