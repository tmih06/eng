import { DurableObject } from "cloudflare:workers";

interface BoardSnapshot {
  elements: unknown[];
  files: Record<string, unknown>;
}

interface Env {
  ASSETS: Fetcher;
  BOARDS: DurableObjectNamespace<BoardRoom>;
}

const emptySnapshot: BoardSnapshot = {
  elements: [],
  files: {},
};

export class BoardRoom extends DurableObject<Env> {
  async getSnapshot(): Promise<BoardSnapshot> {
    return (await this.ctx.storage.get<BoardSnapshot>("snapshot")) ?? emptySnapshot;
  }

  async saveSnapshot(snapshot: BoardSnapshot): Promise<void> {
    await this.ctx.storage.put("snapshot", snapshot);
  }
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function getBoardId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/boards\/([a-zA-Z0-9_-]+)$/);
  return match?.[1] ?? null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const boardId = getBoardId(url.pathname);

    if (!boardId) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "PUT") {
      return json({ error: "Method not allowed" }, 405);
    }

    const room = env.BOARDS.getByName(boardId);
    if (request.method === "GET") return json(await room.getSnapshot());

    let snapshot: BoardSnapshot;
    try {
      snapshot = (await request.json()) as BoardSnapshot;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (
      !Array.isArray(snapshot.elements) ||
      !snapshot.files ||
      typeof snapshot.files !== "object" ||
      Array.isArray(snapshot.files)
    ) {
      return json({ error: "Invalid board snapshot" }, 400);
    }

    await room.saveSnapshot(snapshot);
    return json({ ok: true });
  },
};
