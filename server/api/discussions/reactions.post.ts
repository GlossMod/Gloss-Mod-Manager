import { requireGitHubSession } from "../../utils/github-auth";
import {
    parseReactionInput,
    toggleDiscussionReaction,
} from "../../utils/github-discussions";

export default defineEventHandler(async (event) => {
    const session = requireGitHubSession(event);
    const reaction = parseReactionInput(await readBody(event));

    await toggleDiscussionReaction(
        reaction.subjectId,
        reaction.content,
        reaction.viewerHasReacted,
        session.accessToken,
    );

    return { ok: true };
});
