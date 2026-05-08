import { completeGitHubLogin } from "../../../../server/utils/github-auth";

export default defineEventHandler(async (event) => {
    const redirectTo = await completeGitHubLogin(event);

    return sendRedirect(event, redirectTo);
});
