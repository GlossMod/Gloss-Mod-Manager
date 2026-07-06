import {
    parseCrowdfundingPaymentStatusInput,
    refreshCrowdfundingPaymentStatus,
} from "../../../utils/game-crowdfunding";
import { getGitHubSession } from "../../../utils/github-auth";

export default defineEventHandler(async (event) => {
    const input = parseCrowdfundingPaymentStatusInput(await readBody(event));
    const session = getGitHubSession(event);

    return refreshCrowdfundingPaymentStatus(input, session?.accessToken);
});
