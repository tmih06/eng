# Canvas whiteboard

A full-stack React whiteboard built with Excalidraw and Cloudflare Workers. Board snapshots are stored in a SQLite-backed Durable Object.

## Local development

```sh
bun install
bun run dev
```

Open `http://localhost:5173/`.

The Cloudflare Vite plugin runs the Worker locally, including the Durable Object binding. Drawing changes are saved to local Worker storage after a short debounce.

## Image OCR

Importing an image does not start OCR. Circling or underlining a word with the Draw/pen tool sends only the selected region (a compressed JPEG at most 512 pixels on its longest side) through `POST /api/ocr` to Groq's Qwen 3.8 27B vision model. The request is bounded by a 4.5-second deadline and returns a clear rate-limit message when the free quota is exhausted. An underline selects the word directly above the stroke and works in either direction. Typed text is matched locally, including individual words in a sentence. Minimal thinking and a single-word response keep the image request small. The Worker validates the result. Open loops are supported; circle recognition starts when you pause or release the stroke, and image underlines are read on release so an unfinished line does not crop the wrong word.

Each new circle or underline on an image reads that newly selected region, so you can retry after a bad read or choose a nearby word without stale cache interference. Empty circles are silent. Image OCR runs quietly and only shows a word toast after a word is identified. Lines on blank canvas, vertical/steep strokes, and typed-text strikethroughs do not trigger word lookup.

Copy `.dev.vars.example` to `.dev.vars`, set `GROQ_API_KEY` and optional `GROQ_API_KEY_2`/`GROQ_API_KEY_3` fallbacks, and restart the dev server. `.dev.vars` is ignored by Git; never use a `VITE_` variable for this key. Groq rate limits and account quotas apply; there is no paid-provider or local OCR fallback. Failed requests display an error and can be retried by circling or underlining again.

Recognized words and dictionary results share one bottom-right Ding toast. It updates in place to show pronunciation, meaning, and an example; definitions stay visible until dismissed. Lookup failures still show an error toast, and long definitions can be scrolled. Keyboard help sits beside Library at the top, leaving the bottom-right corner free for the toast.

For production, configure `GROQ_API_KEY`, `GROQ_API_KEY_2`, and `GROQ_API_KEY_3` as Cloudflare Worker secrets with `bunx wrangler secret put <NAME>` before using image OCR. Keys are tried in order when Groq returns rate-limit or provider errors. Local secrets are not deployed automatically.

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
