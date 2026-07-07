import {
    parseCrowdfundingPaymentStatusInput,
    refreshCrowdfundingPaymentStatus,
} from "../../../utils/game-crowdfunding";

export default defineEventHandler(async (event) => {
    const input = parseCrowdfundingPaymentStatusInput(await readBody(event));

    return refreshCrowdfundingPaymentStatus(input);
});
