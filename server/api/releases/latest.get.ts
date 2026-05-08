export default defineEventHandler(async () => {
    const runtimeConfig = useRuntimeConfig();
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "Gloss-Mod-Manager-Web",
    };

    if (runtimeConfig.githubToken) {
        headers.Authorization = `Bearer ${runtimeConfig.githubToken}`;
    }

    return await $fetch(
        "https://api.github.com/repos/GlossMod/Gloss-Mod-Manager/releases/latest",
        { headers },
    );
});
