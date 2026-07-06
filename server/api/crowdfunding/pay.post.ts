import {
    createCrowdfundingPayment,
    parseCrowdfundingPaymentInput,
} from "../../utils/game-crowdfunding";
import { getGitHubSession } from "../../utils/github-auth";

export default defineEventHandler(async (event) => {
    const input = parseCrowdfundingPaymentInput(await readBody(event));
    const session = getGitHubSession(event);

    return createCrowdfundingPayment(input, session?.accessToken);
});
