# Canvas whiteboard

A full-stack React whiteboard built with Excalidraw and Cloudflare Workers. Board snapshots are stored in a SQLite-backed Durable Object.

## Local development

```sh
bun install
bun run dev
```

Open `http://localhost:5173/`.

The Cloudflare Vite plugin runs the Worker locally, including the Durable Object binding. Drawing changes are saved to local Worker storage after a short debounce.

## Deploy

Authenticate with Wrangler, then run:

```sh
bun run deploy
```

The Worker serves the React app and the board API from one Cloudflare deployment. Cloudflare Workers and Durable Objects are available on the Workers Free plan within its published limits.

## Checks

```sh
bun run build-types
bun run lint
bunx react-doctor
bunx wrangler deploy --dry-run
```
