---
name: mod-download-and-install
description: "Mod 安装 和卸载相关操作,  使用这个 skills 能让Agent知道Gloss Mod Manager 是如何对Mod进行下载和安装的, 以及如何正确地卸载一个Mod. 这个技能适用于需要安装新Mod或者卸载现有Mod的场景, 也适用于需要检查安装步骤或者排查安装问题的场景."
argument-hint: "Game, mod effect, author/site, or installation problem"
---

# Mod Download and Install Workflow

## What This Skill Does

Use this skill to help a user find a mod for the current game, inspect its details and install instructions, verify dependencies, and install it through Gloss Mod Manager.
It starts from the currently selected managed game, maps that to the 3DM Mod site `GlossGameId`, filters candidate mods, and then validates the installation path and result.

## When To Use

- The user wants to find and install a new mod.
- The user knows the game but not the exact mod.
- The user wants to search by effect, tag, category, author, or file type.
- The user wants to confirm whether a mod is compatible before installing.
- The user needs a clear install path from 3DM Mod docs, site pages, or bundled readme files.
- The user wants to know whether a failure is caused by the manager or by the mod itself.

## Core Rules

- Start from the currently managed game.
- Resolve the current game's `GlossGameId` before searching for mods.
- Use the 3DM Mod search and detail tools to discover candidate mods and installation guidance.
- Treat map mark import tools as unrelated to mod discovery; do not use them for mod search.
- Validate the mod's documentation before installing whenever possible.
- If the manager behavior conflicts with the documented install method, prepare a GitHub issue draft.

## Recommended Workflow

1. Confirm the current managed game.
    - Use `mcp_gloss-mod-man_get-current-managed-game` first.
    - If no game is currently managed, ask for the target game or register the game before proceeding.

2. Resolve the game identity.
    - Use the current game's `GlossGameId`, which corresponds to the 3DM Mod site game ID.
    - If needed, translate the game name to a supported Gloss game entry.

3. Search for candidate mods.
    - Use `mcp_3mod-mcp_get-mod-list`, `mcp_3mod-mcp_search-v3-content`, or related listing tools to filter by game, tag, author, update time, or effect.
    - Narrow the result set before opening detail pages.

4. Inspect the selected mod.
    - Use `mcp_3mod-mcp_get-mod-detail` to review the mod's description, files, version, author, and links.
    - Confirm the mod actually matches the intended gameplay effect.

5. Check installation instructions.
    - Read any bundled `*.txt`, `readme`, or similar files in the mod package.
    - If the mod exposes a `modWebsite`, open that site and look for install steps.
    - If the site is unclear, inspect the original post and, if needed, comments for installation questions and answers.
    - Use https://gmm.aoe.top/ as an additional documentation source when relevant.

6. Verify prerequisites and compatibility.
    - Check whether required loaders, frameworks, DLL injectors, or companion mods are already installed.
    - Check whether the mod requires a specific game version or a specific folder layout.
    - Check whether the mod type is supported by the current game and manager implementation.

7. Compare against manager logic.
    - After identifying the concrete install method, compare it with the matching implementation under https://github.com/GlossMod/Gloss-Mod-Manager/tree/v2/src/Expands.
    - Make sure the source behavior matches the documented method for the selected game and mod type.

8. Install the mod.
    - Use `mcp_gloss-mod-man_install-mod-by-id` for a local mod record when the mod is already available in the manager.
    - If the mod needs to be imported, copied, or staged first, perform that step before installation.
    - Confirm the active game has not changed during the process.

9. Verify the result.
    - Re-check the current mod list and any relevant file locations.
    - If the mod does not work, look for log errors or missing prerequisites before assuming the install failed.

10. Split the outcome.

- If the manager is at fault, generate an issue-ready GitHub report.
- If the mod documentation is incomplete, describe the exact missing step.
- If the issue is user-side, explain the missing prerequisite or incorrect install step.

## Decision Logic

- If no current game exists: stop and ask the user which game to manage.
- If the mod search returns no relevant results: broaden filters or ask for more detail.
- If the mod detail page lacks installation guidance: check the mod's site, original post, and comments.
- If prerequisites are missing: install them first, then re-test.
- If the documented install method differs from the manager behavior: treat it as a manager bug and draft an issue.
- If the mod is incompatible with the game version or mod type: report the blocker clearly.
- If the mod is valid but the user installed it incorrectly: explain the correct method.

## Issue Report Format

If the problem appears to be caused by the manager, output a GitHub issue-ready draft with:

- Title: short, specific summary of the failure.
- Environment: game name, GlossGameId, manager version, mod name, and mod type.
- Expected result: what should happen after installation.
- Actual result: what fails in practice.
- Installation method: what the docs, site, or original post say.
- Source comparison: which Expands logic appears inconsistent with the documented method.
- Logs or evidence: relevant errors, missing files, or failed steps.
- Reproduction steps: the shortest reliable sequence.

## Quality Check

The workflow is complete only when one of these is true:

- The user has a working install path for the selected mod.
- The missing prerequisite or wrong install step has been identified.
- The mod is confirmed incompatible or unsupported, with the exact blocker stated.
- A manager bug has been isolated and a usable GitHub issue draft has been produced.

## Example Prompts

- "Find a mod for the current game that changes character appearance and install it."
- "Search mods for this game and show only file-based mods with clear install instructions."
- "Check whether this mod's installation method matches the Gloss Mod Manager source."
- "Install this mod and tell me if the failure is caused by the manager or the mod."

## Related Skills

- `mod-not-working-troubleshooting` for diagnosing mods that fail after installation.
- `gloss-mod-manager` for adding or switching managed games.