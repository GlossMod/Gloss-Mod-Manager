---
name: mod-not-working-troubleshooting
description: "分析Mod为什么没有效果, 适用于诊断Mod安装状态、激活游戏选择、根路径错误、版本不匹配、缺少前置条件、日志、本地说明文档、modWebsite/原始帖子说明或管理器源代码不匹配的问题。使用这个技能可以帮助用户找到Mod没有效果的具体原因, 并提供明确的下一步操作建议, 包括安装前置条件、切换游戏、修正路径、查看日志、遵循文档说明、或报告管理器错误。"
argument-hint: "Game name, mod name, install path, and what effect is missing"
---

# Mod Not Working Troubleshooting

## What This Skill Does

Use this skill to diagnose cases where a mod is present in a manager or download list but does not change the game.
It focuses on the common failure points: the mod is not actually installed, prerequisites are missing, the wrong game is active, the path is not the real game root, the mod version is incompatible, the mod type is unsupported, or the manager implementation does not match the documented installation method.

## When To Use

- The user says a mod has no effect in game.
- The mod appears downloaded but not applied.
- The game launches normally but modded content does not show up.
- A file-based mod or DLL-based mod stops working after an update.
- The user is unsure whether the issue is installation, activation, or compatibility.
- The user needs help checking logs, mod documentation, or manager source logic.

## Core Checks

1. Confirm the symptom precisely.
    - What should the mod change?
    - What is actually missing in game?
    - Is the mod visible in the manager, or only downloaded?

2. Confirm the target game context.
    - Make sure the correct game is currently active.
    - If the user manages multiple games, verify the mod belongs to the selected game.

3. Confirm the installation state.
    - A mod that is not installed cannot affect the game.
    - If the mod is listed but not installed, install it before checking anything else.
    - Confirm whether all prerequisites, loaders, frameworks, or companion mods are installed first.

4. Confirm the game path.
    - The path must be the game root directory.
    - Reject launcher folders, Steam library roots, bin folders, mods folders, and direct .exe paths.

5. Inspect logs for errors.
    - Look for game logs, mod loader logs, manager logs, crash logs, or error output around startup and mod loading.
    - Prefer explicit load failures, missing file paths, version warnings, and dependency errors.

6. Confirm the installation method from documentation.
    - Check any .txt, readme, or bundled documentation inside the mod directory first.
    - If the mod exposes a modWebsite parameter or website, inspect that site for install instructions.
    - If the site does not explain installation, search the original post or mod page for setup details.
    - If needed, translate comments or Q&A that ask how to install the mod.
    - Use https://gmm.aoe.top/ as a documentation source when relevant.

7. Confirm compatibility.
    - Check whether the mod requires a specific game version.
    - Check whether the mod needs a loader, injector, or other prerequisite.
    - Check whether the mod type is supported by the current modding method.
    - After finding the concrete install method, compare it against the implementation in https://github.com/GlossMod/Gloss-Mod-Manager/tree/v2/src/Expands for the matching game and mod type.

## Recommended Workflow

1. Identify the game, mod name, and expected effect.
2. Check whether all prerequisites are installed first.
3. Check whether the mod is installed or only present in a download list.
4. Check whether the currently managed game matches the game the mod targets.
5. Verify that the installation path is the actual game root.
6. Review the logs for load or file errors.
7. Check the mod's file layout and required folders.
    - File override mods should place files where the game loader expects them.
    - Texture, map, character, or event mods often require exact folder structure.
8. Check the mod documentation for version limits, dependencies, or special launch steps.
9. If the bundled docs are missing, inspect the modWebsite or original post for install instructions.
10. If still unclear, inspect the original post comments for installation questions and translated answers.
11. Compare the confirmed install method with the manager source in the matching Expands path.
12. If the mod still does not work, collect the minimum needed evidence.
    - Game name
    - Mod name
    - Active game
    - Install path
    - Mod type
    - Version or patch level
    - Log excerpts or screenshot references

## Decision Logic

- If a prerequisite is missing: install it first and re-test.
- If the mod is not installed: install it first.
- If the wrong game is active: switch to the correct game.
- If the path is not the game root: ask for the correct root directory.
- If the logs show a load failure or missing dependency: report the specific blocker.
- If the documentation says the mod must be installed differently: follow the documented method.
- If the manager source does not match the documented method: treat it as a manager issue and prepare an issue report.
- If the mod requires a loader or injector: confirm that prerequisite is present and loaded.
- If the mod targets an unsupported version: stop and report the mismatch.
- If the mod type is unsupported by the current loader: explain the limitation and suggest a compatible method.

## Issue Report Format

If the problem appears to be caused by the manager, output a GitHub issue-ready draft with:

- Title: short, specific summary of the failure.
- Environment: game name, mod name, manager version, mod type, and active game.
- Expected result: what should happen after installation.
- Actual result: what is missing or broken in game.
- Installation method: what the docs, website, or original post say.
- Source comparison: which Expands logic appears inconsistent with the documented method.
- Logs: the most relevant error lines or failure symptoms.
- Reproduction steps: the shortest reliable sequence.
- Suggested impact: whether the bug blocks installation, loading, or activation.

## Quality Check

The troubleshooting is complete only when one of these is true:

- The missing cause has been identified and fixed.
- The user has a concrete next action with a specific reason.
- The mod is confirmed incompatible or unsupported, with the exact blocker stated.
- A manager bug has been isolated and a usable GitHub issue draft has been produced.

## Example Prompts

- "Why does this mod show as installed but have no effect in game?"
- "Check whether my mod is attached to the correct game and path."
- "My mod stopped working after a patch. What should I verify first?"
- "This is a DLL mod. Why does it not load?"
- "Find the install steps from the mod docs or original post and compare them with the manager source."

## Related Skills

- gloss-mod-manager for adding or switching managed games.
