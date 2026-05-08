import { requireGitHubSession } from "../../utils/github-auth";
import {
    createNewGameDiscussion,
    getDiscussionByNumber,
    parseNewGameRequest,
} from "../../utils/github-discussions";

export default defineEventHandler(async (event) => {
    const session = requireGitHubSession(event);
    const request = parseNewGameRequest(await readBody(event));
    const discussion = await createNewGameDiscussion(
        request,
        session.accessToken,
    );
    const detail = await getDiscussionByNumber(
        discussion.number,
        session.accessToken,
    );

    return {
        discussion,
        detail,
    };
});
