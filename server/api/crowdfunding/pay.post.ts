import {
    createCrowdfundingPayment,
    parseCrowdfundingPaymentInput,
} from "../../utils/game-crowdfunding";
import {
    getGitHubSession,
    isGitHubOAuthConfigured,
} from "../../utils/github-auth";

export default defineEventHandler(async (event) => {
    const input = parseCrowdfundingPaymentInput(await readBody(event));
    const session = getGitHubSession(event);

    if (!session && isGitHubOAuthConfigured()) {
        throw createError({
            statusCode: 401,
            statusMessage:
                "GitHub login is required before creating crowdfunding payment records.",
        });
    }

    return createCrowdfundingPayment(input, session?.accessToken);
});
