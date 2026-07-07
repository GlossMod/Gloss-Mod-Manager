import {
    createCrowdfundingPayment,
    parseCrowdfundingPaymentInput,
} from "../../utils/game-crowdfunding";

export default defineEventHandler(async (event) => {
    const input = parseCrowdfundingPaymentInput(await readBody(event));

    return createCrowdfundingPayment(input);
});
