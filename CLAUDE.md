# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gloss Mod Manager (GMM) is a cross-platform (Windows/macOS/Linux) desktop app for browsing, downloading, installing, and managing game mods. It ships a built-in AI chat assistant that operates the app itself via an embedded MCP server. V2 is a full rewrite of V1 focused on install-size reduction and adding AI/MCP/Skills capabilities; it is designed to stay data-compatible with V1 (mod list, game list, custom games, tag categories, backups).

## Commands

```bash
yarn dev              # vite dev server (frontend only, no Tauri window)
yarn tauri dev         # full app in dev mode (Rust + frontend)
yarn build             # vue-tsc --noEmit type-check, then vite build
yarn tauri build       # full production build (run this after backend/frontend changes to verify no compile errors)
yarn preview           # preview a production build of the frontend
```

There are no lint or test scripts configured in `package.json` — no ESLint/Prettier/Vitest setup exists in this repo currently. Don't assume any exist when investigating failures.

`predev`/`prebuild`/`pretauri` hooks automatically run `scripts/sync-version.ts` (keeps version numbers in sync across `package.json`/`Cargo.toml`/etc.) and `scripts/prepare-sidecars.ts` (stages bundled external binaries into `src-tauri/binaries/`) — you don't need to run these manually before `dev`/`build`/`tauri` commands.

## Architecture

### Split between Rust and TypeScript

The Rust side (`src-tauri/`) is intentionally kept as thin as possible: native OS capabilities (filesystem, stronghold-encrypted storage, single-instance, deep-link/file-association handling, autostart, window state, logging) plus a raw-socket MCP transport bridge. All business logic — mod install/uninstall, game detection, download orchestration, MCP protocol semantics — lives in TypeScript. Prefer implementing new functionality in TypeScript; only drop into Rust when something genuinely cannot be done from the frontend (e.g. new native OS integration).

### Expands: per-game mod install logic (`src/Expands/`)

Each supported game is one file in `src/Expands/`, exporting an async `supportedGames(): Promise<ISupportedGames>`. Files are auto-discovered via `import.meta.glob("./*.ts", { eager: true })` in `src/Expands/index.ts` — there is no central registry to update when adding a new game; dropping a new file into that folder is sufficient.

Each game's `modType` can either be a full custom `IType[]` array (with per-type `install`/`uninstall` implementations) or delegate to shared engine-specific logic:
- `src/lib/UnityGame.ts` — generic Unity mod install logic
- `src/lib/UnrealEngine.ts` — generic Unreal Engine install logic (handles pak/UE4SS mod layouts)

Most Expand files use `Manager.checkInstalled`, `Manager.getModStoragePath`, `Manager.generalInstall`/`generalUninstall`, and `FileHandler.*` helpers (`src/lib/Manager.ts`, `src/lib/FileHandler.ts`) rather than writing bespoke file-copy logic. Look at an existing Expand file (e.g. `EldenRing.ts`) before adding a new game — most games follow the same shape (dictionary-file-based mod-to-path mapping, `modType` list, optional `checkModType` classifier).

Legacy V1 custom games/types (user-defined, not shipped as Expand files) are merged in at runtime by `src/lib/legacy-custom-data.ts` and combined with the built-in Expands list in `getAllExpands()`.

The global ambient type definitions for this whole system (`ISupportedGames`, `IType`, `IModInfo`, `IGameInfo`, `ISettings`, per-mod-source interfaces like `IThunderstoreMod`/`ISteamWorkshopItem`/`ICurseForgeMod`/`IGitHubRelease`/`IGameBananaMod`/`INexusMods`, etc.) live in `src/ts/Interfaces.d.ts` — a single ambient `.d.ts` with no imports/exports, so all these types are globally available without importing.

### MCP server: Rust is transport-only

`src-tauri/src/mcp_server.rs` implements a hand-rolled HTTP/1.1 server directly over `TcpListener` (no HTTP crate), bound to `127.0.0.1` only. It does not implement any MCP protocol logic itself — it accepts a POST to `/mcp`, emits an `mcp-http-request` Tauri event with the request body, and blocks (with a 60s timeout) until the frontend calls back the `mcp_complete_request` command with a status code and body. All actual JSON-RPC/MCP protocol handling and tool dispatch lives in `src/lib/mcp-service.ts`. When changing MCP behavior (adding tools, changing responses), the change almost always belongs in `mcp-service.ts`, not in Rust.

### Skills (`src/skills/*/SKILL.md`)

These are runtime workflow docs consumed by the app's own in-app AI assistant (distinct from Claude Code's skill system) — written in Chinese, each documenting a workflow in terms of the MCP tool names exposed by `mcp-service.ts` (e.g. `mcp_gloss-mod-man_add-game-to-manager`). When adding new MCP tools that represent a multi-step user workflow, consider whether a corresponding SKILL.md should be added or updated.

### Frontend structure

- File-based routing via `unplugin-vue-router`: pages live in `src/pages/*.vue` and are auto-registered as routes through `vue-router/auto-routes` (`src/routes/index.ts`); there's no manual route table to edit.
- State is managed with Pinia stores under `src/stores/` (e.g. `manager.ts` for the currently managed game/mod state, `settings.ts`, `ai-chat.ts`). Note `src/stores/manager.ts` (Pinia store) is distinct from `src/lib/Manager.ts` (the static class with install/uninstall/tag utilities) — don't conflate the two.
- Auto-import is configured in `vite.config.ts`: Vue/vue-router/@vueuse/core/pinia APIs, plus everything exported from `src/lib/` and `src/stores/`, are available without explicit imports. Components under `src/components/ui` and `src/components/` are auto-registered; any component name starting with `Icon` resolves to `lucide-vue-next`.
- Prefer shadcn-vue components (built on reka-ui, styled with Tailwind v4) over hand-rolled custom components for UI work.
- i18n: `src/lang/*.ts` (one file per locale) plus `src/lang/index.ts`/`locales.ts`. Add new user-facing strings to all locale files, or at minimum `zh_CN.ts` (source language) and `en_US.ts`.

### Downloads and external tooling

- `aria2-rpc.ts` / `aria2.ts` / `aria2-task-cache.ts` in `src/lib/` integrate with an external aria2 process via JSON-RPC for actual file downloads.
- Sidecar binaries (external tool executables bundled with the app, staged by `scripts/prepare-sidecars.ts` into `src-tauri/binaries/`) are invoked through `src/lib/sidecar.ts`. `sevenZip.ts` and `dotnet-tool.ts` wrap specific bundled tools.
- Mod sources are integrated individually per platform: NexusMods, Thunderstore, Mod.io, SteamWorkshop, CurseForge, GitHub, GameBanana, plus the native GlossMod platform (`gloss-mod-api.ts`, `gloss-download-queue.ts`). Each has its own interface set in `Interfaces.d.ts` and its own API client under `src/lib/`.
- Custom URI/file handling: `gmm://` and `nxm://` (Nexus Mods download protocol) URIs, and `.gmm` file association, are parsed on the Rust side in `src-tauri/src/lib.rs` (`normalize_file_launch_arg`) and surfaced to the frontend via the `app-launch-files` event / `app_take_pending_launch_files` command.

## Code style

Full rules are in `CodeStyle.md` — key points not enforced by tooling (no linter configured):
- PascalCase for classes, camelCase for variables/functions, kebab-case for filenames.
- Interfaces prefixed `I` (e.g. `IModInfo`), enums prefixed `E`, type aliases/generics PascalCase.
- Always type variable declarations explicitly; avoid `any`.
- `const` over `readonly`; one import per module; no namespaces (use ES6 import/export).
- Comments are written in Chinese, added at the author's discretion where the "why" isn't obvious from the code — this is the existing convention for this codebase, follow it when adding comments.
- 4-space indentation, same-line braces, template strings over concatenation, destructuring preferred.

From `.github/copilot-instructions.md`:
- This project targets Tauri 2.0 — check the Tauri JS API and plugin docs before making Tauri-related changes, since the API differs from Tauri 1.x.
- Run `yarn tauri build` after making changes to confirm there are no compile errors.
