import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { Agentation } from "agentation";
import { useCallback, useEffect, useMemo, useRef } from "react";

interface BoardSnapshot {
  elements: readonly ExcalidrawElement[];
  files: BinaryFiles;
}

const boardId = "default";

async function loadBoard(): Promise<BoardSnapshot | null> {
  const response = await fetch(`/api/boards/${boardId}`);
  if (!response.ok) return null;
  return response.json() as Promise<BoardSnapshot>;
}

async function saveBoard(
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles,
): Promise<void> {
  await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ elements, files }),
  });
}

function App() {
  const initialData = useMemo(() => loadBoard().catch(() => null), []);
  const saveTimer = useRef<number | undefined>(undefined);
  const handleChange = useCallback((elements: readonly ExcalidrawElement[], files: BinaryFiles) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveBoard(elements, files);
    }, 500);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(saveTimer.current);
  }, []);

  return (
    <>
      <main className="app-shell">
        <section className="canvas-stage" aria-label="Whiteboard canvas">
          <Excalidraw
            initialData={initialData}
            onChange={(elements, _appState, files) => handleChange(elements, files)}
          />
        </section>
      </main>
      {import.meta.env.DEV && <Agentation />}
    </>
  );
}

export default App;
