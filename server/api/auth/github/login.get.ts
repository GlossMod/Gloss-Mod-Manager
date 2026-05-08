import { createGitHubLoginUrl } from "../../../../server/utils/github-auth";

export default defineEventHandler((event) => {
    const query = getQuery(event);
    const redirectTo =
        typeof query.redirect === "string" ? query.redirect : "/add-new-game";
    console.log({ redirectTo });

    return sendRedirect(event, createGitHubLoginUrl(event, redirectTo));
});
