import { getGitHubSession } from "../../utils/github-auth";
import { getDiscussionByNumber } from "../../utils/github-discussions";

export default defineEventHandler(async (event) => {
    const discussionNumber = Number(getRouterParam(event, "number"));

    if (!Number.isInteger(discussionNumber) || discussionNumber <= 0) {
        throw createError({
            statusCode: 400,
            statusMessage: "A valid discussion number is required.",
        });
    }

    const session = getGitHubSession(event);
    const discussion = await getDiscussionByNumber(
        discussionNumber,
        session?.accessToken,
    );

    return { discussion };
});
