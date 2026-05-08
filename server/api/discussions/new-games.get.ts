import { getGitHubSession } from "../../utils/github-auth";
import { listNewGameDiscussions } from "../../utils/github-discussions";

export default defineEventHandler(async (event) => {
    const session = getGitHubSession(event);
    const discussions = await listNewGameDiscussions(session?.accessToken);

    return { discussions };
});
