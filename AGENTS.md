# AGENTS.md

## Project context

This repository contains a full-stack React whiteboard named Canvas.

- The frontend uses React, TypeScript, Vite, and Excalidraw.
- The Worker serves the Vite-built static assets.
- The Worker exposes the board API at `/api/boards/:boardId`.
- A SQLite-backed Durable Object stores each board snapshot.
- Agentation runs only in development.
- React Doctor checks the React codebase.
- The app targets Cloudflare Workers Free within its published limits.

The frontend and Worker share this snapshot shape:

```ts
interface BoardSnapshot {
  elements: readonly ExcalidrawElement[];
  files: BinaryFiles;
}
```

Keep the frontend and Worker contract aligned when you change it.

## Tooling rules

Use Bun for this project. Do not use npm, pnpm, or yarn.

```sh
bun install
bun run dev
bun run build
bun run build-types
bun run lint
bun run deploy
```

`bun.lock` is the dependency lockfile. Keep it in sync with `package.json`.

## Source map

- `src/App.tsx` owns the Excalidraw surface and board persistence calls.
- `src/index.css` owns the full-screen canvas layout and browser constraints.
- `worker/index.ts` owns API routing, snapshot validation, and Durable Object access.
- `worker/tsconfig.json` type-checks Worker code against Cloudflare runtime types.
- `wrangler.jsonc` owns the Worker, asset routing, Durable Object binding, migration, and observability settings.
- `vite.config.ts` connects the React build to the Cloudflare Vite plugin.

## Cloudflare rules

Use the Cloudflare Vite plugin for local development and production builds.

Keep `/api/*` on the Worker. Let the asset binding serve other requests.

Use `BOARDS.getByName(boardId)` for deterministic board routing. Do not create one global Durable Object for every board.

Persist board state before relying on an in-memory value. Durable Objects can be evicted and restarted.

Keep secrets out of client code, source files, and `wrangler.jsonc`. Use Cloudflare secrets for private runtime values.

Do not run a remote deployment unless the user asks for it. Use `bunx wrangler deploy --dry-run` to validate packaging without changing the account.

## Frontend rules

Keep Excalidraw as the owner of canvas interaction, tools, selection, import, export, and image handling.

Do not place custom overlays over Excalidraw controls without reserving layout space. Prefer a normal layout boundary over absolute positioning.

Debounce persistence writes. Drawing emits frequent changes, and each write consumes free-tier budget.

Treat a failed load as an empty board for local development. Do not make the canvas unusable when the API is unavailable.

Validate API responses before using them as board data. Keep external data parsing at the Worker boundary and keep the client contract typed.

## Engineering principles

- Make the smallest change that fixes the root cause.
- Model domain data with typed interfaces and explicit boundaries.
- Keep one owner for each concern. Do not duplicate canvas state in React.
- Prefer direct data flow over wrapper components and hidden mutable state.
- Put validation at the Worker boundary. Trust typed internal values after validation.
- Make repeated saves safe. A board PUT must converge to the submitted snapshot.
- Delete obsolete dependencies, styles, and configuration when replacing a library.
- Do not bypass third-party licensing or hide license enforcement with CSS.
- Do not add authentication, collaboration, or schema versions without a requested requirement.

## Verification

Run the narrow checks after each change.

```sh
bun run build-types
bun run lint
bun run build
bunx react-doctor
bunx wrangler deploy --dry-run
```

For persistence changes, start the development server and test both API requests. Check the response body, not only the process status.
