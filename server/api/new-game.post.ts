import {
    createNewGameDiscussion,
    getDiscussionByNumber,
    parseNewGameRequest,
} from "../utils/github-discussions";
import { requireGitHubSession } from "../utils/github-auth";

export default defineEventHandler(async (event) => {
    const session = requireGitHubSession(event);
    const request = parseNewGameRequest(await readBody(event));
    const discussion = await createNewGameDiscussion(
        request,
        session.accessToken,
    );

    return {
        discussion,
        detail: await getDiscussionByNumber(
            discussion.number,
            session.accessToken,
        ),
    };
});
