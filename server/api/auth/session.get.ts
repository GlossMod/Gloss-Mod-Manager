import {
    getGitHubSession,
    isGitHubOAuthConfigured,
} from "../../../server/utils/github-auth";

export default defineEventHandler((event) => {
    const session = getGitHubSession(event);

    return {
        isConfigured: isGitHubOAuthConfigured(),
        isLoggedIn: Boolean(session),
        viewer: session?.viewer ?? null,
    };
});
