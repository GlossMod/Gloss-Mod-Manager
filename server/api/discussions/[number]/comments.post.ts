import { requireGitHubSession } from "../../../utils/github-auth";
import {
    addDiscussionComment,
    getDiscussionByNumber,
    parseDiscussionCommentInput,
} from "../../../utils/github-discussions";

export default defineEventHandler(async (event) => {
    const discussionNumber = Number(getRouterParam(event, "number"));

    if (!Number.isInteger(discussionNumber) || discussionNumber <= 0) {
        throw createError({
            statusCode: 400,
            statusMessage: "A valid discussion number is required.",
        });
    }

    const session = requireGitHubSession(event);
    const discussion = await getDiscussionByNumber(
        discussionNumber,
        session.accessToken,
    );
    const commentInput = parseDiscussionCommentInput(await readBody(event));

    await addDiscussionComment(
        discussion.id,
        commentInput.body,
        session.accessToken,
        commentInput.replyToId,
    );

    return {
        discussion: await getDiscussionByNumber(
            discussionNumber,
            session.accessToken,
        ),
    };
});
