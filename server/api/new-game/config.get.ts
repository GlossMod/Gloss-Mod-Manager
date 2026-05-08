import { getNewGamesDiscussionConfig } from "../../utils/github-discussions";

export default defineEventHandler(async () => {
    const config = await getNewGamesDiscussionConfig();

    return {
        oauthConfigured: Boolean(
            useRuntimeConfig().githubClientId &&
            useRuntimeConfig().githubClientSecret &&
            useRuntimeConfig().sessionSecret,
        ),
        repositoryId: config.repositoryId,
        category: "new-games",
        categoryId: config.categoryId,
    };
});
