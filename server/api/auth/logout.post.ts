import { clearGitHubSession } from "../../../server/utils/github-auth";

export default defineEventHandler((event) => {
    clearGitHubSession(event);

    return { ok: true };
});
