import {
    parseCrowdfundingPaymentStatusInput,
    refreshCrowdfundingPaymentStatus,
} from "../../../utils/game-crowdfunding";
import {
    getGitHubSession,
    isGitHubOAuthConfigured,
} from "../../../utils/github-auth";

export default defineEventHandler(async (event) => {
    const input = parseCrowdfundingPaymentStatusInput(await readBody(event));
    const session = getGitHubSession(event);

    if (!session && isGitHubOAuthConfigured()) {
        throw createError({
            statusCode: 401,
            statusMessage:
                "GitHub login is required before updating crowdfunding payment records.",
        });
    }

    return refreshCrowdfundingPaymentStatus(input, session?.accessToken);
});
