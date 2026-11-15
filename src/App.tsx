import { Excalidraw, FONT_FAMILY } from "@excalidraw/excalidraw";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LearningState } from "./LearningToast";
import { WordToaster } from "./WordToaster";
import type { VocabularyResult } from "../shared/vocabulary";
import { toast } from "@yusufceng1z/ding";
import type { OcrResponse, RecognizedWord } from "../shared/ocr";

interface BoardSnapshot {
  elements: readonly ExcalidrawElement[];
  files: BinaryFiles;
}

interface WordGesture {
  kind: "circle" | "underline";
  word: string | null;
  confidence: number;
  region: Omit<RecognizedWord, "word">;
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

function getTextWords(element: ExcalidrawTextElement): RecognizedWord[] {
  const lines = element.text.split("\n");
  const context = document.createElement("canvas").getContext("2d");
  const family = Object.entries(FONT_FAMILY).find(([, value]) => value === element.fontFamily)?.[0];
  if (context) context.font = `${element.fontSize}px "${family}", sans-serif`;
  const measure = (text: string) => context?.measureText(text).width ?? text.length;
  const maxWidth = Math.max(...lines.map(measure), 1);
  const scale = element.width / maxWidth;
  const height = element.height / lines.length;
  return lines.flatMap((line, row) => {
    const lineWidth = measure(line) * scale;
    const offset =
      element.textAlign === "center"
        ? (element.width - lineWidth) / 2
        : element.textAlign === "right"
          ? element.width - lineWidth
          : 0;
    return [...line.matchAll(/[a-zA-Z]+(?:['-][a-zA-Z]+)*/g)].map((match) => ({
      word: match[0],
      x: element.x + offset + measure(line.slice(0, match.index)) * scale,
      y: element.y + row * height,
      width: measure(match[0]) * scale,
      height,
    }));
  });
}

function combineWords(words: readonly RecognizedWord[]): RecognizedWord | null {
  if (!words.length) return null;
  const ordered = [...words].sort((a, b) =>
    Math.abs(a.y - b.y) < Math.min(a.height, b.height) * 0.5 ? a.x - b.x : a.y - b.y,
  );
  const x = Math.min(...words.map((word) => word.x));
  const y = Math.min(...words.map((word) => word.y));
  return {
    word: ordered.map((word) => word.word).join(" "),
    x,
    y,
    width: Math.max(...words.map((word) => word.x + word.width)) - x,
    height: Math.max(...words.map((word) => word.y + word.height)) - y,
  };
}

function detectWordGesture(
  elements: readonly ExcalidrawElement[],
  points: readonly [number, number][],
  recognizedWords: readonly RecognizedWord[] = [],
): WordGesture | null {
  if (points.length < 2) return null;

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const width = right - left;
  const height = bottom - top;
  const padding = Math.max(20, Math.min(width, height) * 0.08);
  const targets: RecognizedWord[] = [
    ...[...elements]
      .reverse()
      .filter((element) => !element.isDeleted && element.type === "text")
      .flatMap((element) => (element.type === "text" ? getTextWords(element) : [])),
    ...recognizedWords,
  ].filter((target) => target.word);
  const first = points[0];
  const last = points[points.length - 1];
  const pathLength = points.slice(1).reduce((length, [x, y], index) => {
    const previous = points[index];
    return length + Math.hypot(x - previous[0], y - previous[1]);
  }, 0);
  const chordLength = Math.hypot(last[0] - first[0], last[1] - first[1]);
  const isUnderline =
    width >= 12 &&
    Math.abs(last[0] - first[0]) >= width * 0.9 &&
    Math.abs(last[1] - first[1]) <= Math.max(4, width * 0.15) &&
    pathLength <= chordLength * 1.15 &&
    points.every(
      ([x, y]) =>
        Math.abs((last[0] - first[0]) * (first[1] - y) - (first[0] - x) * (last[1] - first[1])) /
          Math.max(chordLength, 1) <=
        Math.max(3, width * 0.06),
    );
  if (isUnderline) {
    const lineY = (target: RecognizedWord) =>
      first[1] +
      ((target.x + target.width / 2 - first[0]) / (last[0] - first[0])) * (last[1] - first[1]);
    const candidates = targets
      .filter((word) => {
        const gap = lineY(word) - (word.y + word.height);
        const overlap = Math.min(right, word.x + word.width) - Math.max(left, word.x);
        return (
          overlap >= word.width * 0.65 &&
          gap >= -word.height * 0.1 &&
          gap <= Math.max(word.height * 0.7, 4)
        );
      })
      .sort((a, b) => Math.abs(lineY(a) - a.y - a.height) - Math.abs(lineY(b) - b.y - b.height));
    const nearest = candidates[0];
    const selected = combineWords(
      candidates.filter(
        (word) =>
          nearest &&
          Math.abs(word.y + word.height - nearest.y - nearest.height) < nearest.height * 0.5,
      ),
    );
    const target = selected && width <= selected.width * 1.8 ? selected : null;
    const region = target
      ? {
          x: target.x - target.height * 0.1,
          y: target.y - target.height * 0.1,
          width: target.width + target.height * 0.2,
          height: target.height * 1.2,
        }
      : {
          x: left - width * 0.05,
          y: (first[1] + last[1]) / 2 - width * 0.6,
          width: width * 1.1,
          height: width * 0.6,
        };
    const overImage = elements.some(
      (element) =>
        !element.isDeleted &&
        element.type === "image" &&
        region.x + region.width / 2 >= element.x &&
        region.x + region.width / 2 <= element.x + element.width &&
        region.y + region.height / 2 >= element.y &&
        region.y + region.height / 2 <= element.y + element.height,
    );
    if (target || overImage)
      return {
        kind: "underline",
        word: target?.word ?? null,
        confidence: Math.round((chordLength / pathLength) * 100),
        region,
      };
    return null;
  }
  if (points.length < 10 || width < 50 || height < 30) return null;
  const text = combineWords(
    targets.filter(
      (target) =>
        target.x + target.width / 2 >= left &&
        target.x + target.width / 2 <= right &&
        target.y + target.height / 2 >= top &&
        target.y + target.height / 2 <= bottom &&
        target.width <= width + padding * 2 &&
        target.height <= height + padding * 2,
    ),
  );
  const centerX = text ? text.x + text.width / 2 : (left + right) / 2;
  const centerY = text ? text.y + text.height / 2 : (top + bottom) / 2;
  const radius = text ? Math.max(text.width, text.height) / 2 : Math.max(width, height) / 2;
  const coveredBins = new Set(
    points.map(([x, y]) => {
      const angle = Math.atan2(y - centerY, x - centerX);
      return Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 16) % 16;
    }),
  );
  let longestArc = 0;
  for (let start = 0; start < 16; start++) {
    let arc = 0;
    while (arc < 16 && coveredBins.has((start + arc) % 16)) arc++;
    longestArc = Math.max(longestArc, arc);
  }
  let sweptAngle = 0;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    const delta =
      Math.atan2(current[1] - centerY, current[0] - centerX) -
      Math.atan2(previous[1] - centerY, previous[0] - centerX);
    sweptAngle += Math.atan2(Math.sin(delta), Math.cos(delta));
  }
  const intendedCircle = text
    ? pathLength > radius * 2 &&
      width > text.width + Math.min(12, text.width * 0.2) &&
      height > text.height * 1.2
    : pathLength > radius * 3 && Math.abs(sweptAngle) >= Math.PI * 1.3;
  if (!intendedCircle) return null;

  return {
    kind: "circle",
    word: text?.word ?? null,
    confidence: Math.round((longestArc / 16) * 100),
    region: { x: left, y: top, width, height },
  };
}

async function lookupVocabulary(word: string, signal: AbortSignal): Promise<VocabularyResult> {
  const response = await fetch("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(7000)]),
  });
  if (!response.ok) throw new Error("Không thể tải bài học cho từ này.");
  return (await response.json()) as VocabularyResult;
}

function App() {
  const excalidraw = useRef<ExcalidrawImperativeAPI | null>(null);
  const initialData = useMemo(() => loadBoard().catch(() => null), []);
  const saveTimer = useRef<number | undefined>(undefined);
  const sceneElements = useRef<readonly ExcalidrawElement[]>([]);
  const gestureActive = useRef(false);
  const penActive = useRef(false);
  const lastDetectedWord = useRef<string | null | undefined>(undefined);
  const toastId = useRef<string | null>(null);
  const definitionController = useRef<AbortController | null>(null);
  const sceneFiles = useRef<BinaryFiles>({});
  const sceneGesture = useRef<[number, number][]>([]);
  const lookupTimer = useRef<number | undefined>(undefined);
  const lookupController = useRef<AbortController | null>(null);
  const lookupStarted = useRef(false);

  const [drawing, setDrawing] = useState(false);
  const [learning, setLearning] = useState<LearningState | null>(null);
  const loadWord = useCallback((word: string) => {
    definitionController.current?.abort();
    const controller = new AbortController();
    definitionController.current = controller;
    toastId.current = toast.loading(word, {
      description: "Đang soạn giải thích bằng tiếng Việt…",
      className: "learning-notification",
    });
    const id = toastId.current;
    setLearning({ word, result: null, error: null });
    void lookupVocabulary(word, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setLearning({ word, result, error: null });
          toast.update(id, {
            type: "success",
            title: word,
            description: "Bài học tiếng Việt đã sẵn sàng.",
            duration: 0,
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLearning({
            word,
            result: null,
            error: "Chưa tải được giải thích. Hãy khoanh tròn hoặc gạch chân lại để thử lại.",
          });
          toast.update(id, {
            type: "error",
            title: word,
            description: "Chưa tải được giải thích.",
            duration: 0,
          });
        }
      });
  }, []);
  const publishCandidate = useCallback(
    (nextCandidate: WordGesture) => {
      if (!penActive.current || !nextCandidate.word) return;
      if (lastDetectedWord.current === nextCandidate.word) return;
      lastDetectedWord.current = nextCandidate.word;
      loadWord(nextCandidate.word);
    },
    [loadWord],
  );
  const readGestureImage = useCallback(
    async (gesture: WordGesture) => {
      if (lookupStarted.current || gesture.word || lastDetectedWord.current || !penActive.current)
        return;
      const { x: left, y: top, width, height } = gesture.region;
      const image = [...sceneElements.current]
        .reverse()
        .find(
          (element) =>
            !element.isDeleted &&
            element.type === "image" &&
            left + width / 2 >= element.x &&
            left + width / 2 <= element.x + element.width &&
            top + height / 2 >= element.y &&
            top + height / 2 <= element.y + element.height,
        );
      if (image?.type !== "image" || !image.fileId) return;
      const file = sceneFiles.current[image.fileId];
      if (!file) return;
      lookupStarted.current = true;
      const controller = new AbortController();
      lookupController.current = controller;
      try {
        const source = new Image();
        source.src = file.dataURL;
        await source.decode();
        if (controller.signal.aborted) return;
        const canvas = document.createElement("canvas");
        const scale = Math.min(3, 512 / Math.max(width, height));
        canvas.width = Math.ceil(width * scale);
        canvas.height = Math.ceil(height * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare the selected image region");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.scale(scale, scale);
        context.translate(image.x + image.width / 2 - left, image.y + image.height / 2 - top);
        context.rotate(image.angle);
        context.scale(image.scale[0], image.scale[1]);
        const crop = image.crop;
        context.drawImage(
          source,
          crop?.x ?? 0,
          crop?.y ?? 0,
          crop?.width ?? source.naturalWidth,
          crop?.height ?? source.naturalHeight,
          -image.width / 2,
          -image.height / 2,
          image.width,
          image.height,
        );
        const response = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataURL: canvas.toDataURL("image/jpeg", 0.85),
            selection: gesture.kind,
          }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6500)]),
        });
        if (!response.ok) {
          throw new Error(
            response.status === 429
              ? "Đã đạt giới hạn lượt đọc ảnh. Vui lòng đợi một lát rồi thử lại."
              : "Chưa đọc được từ trong ảnh. Hãy khoanh tròn hoặc gạch chân lại.",
          );
        }
        const { word } = (await response.json()) as OcrResponse;
        if (controller.signal.aborted || !penActive.current) return;
        if (!word) return;
        publishCandidate({ ...gesture, word });
      } catch (error) {
        if (controller.signal.aborted) return;
        toastId.current = toast.error("Chưa đọc được từ", {
          className: "word-toast",
          description:
            error instanceof Error ? error.message : "Hãy khoanh tròn hoặc gạch chân lại.",
        });
      }
    },
    [publishCandidate],
  );
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      const isPen = appState.activeTool.type === "freedraw";
      if (penActive.current && !isPen) {
        gestureActive.current = false;
        setDrawing(false);
        sceneGesture.current = [];
        window.clearTimeout(lookupTimer.current);
        lookupController.current?.abort();
        definitionController.current?.abort();
        setLearning((current) => (current?.result ? current : null));
        if (toast.getState().toasts.some((item) => item.type === "loading")) toast.dismiss();
      }
      penActive.current = isPen;
      sceneElements.current = elements;
      sceneFiles.current = files;
      const gesture = appState.newElement;
      if (isPen && gestureActive.current && gesture?.type === "freedraw" && !gesture.isDeleted) {
        const points = gesture.points.map(
          ([x, y]) => [gesture.x + x, gesture.y + y] as [number, number],
        );
        if (points.length !== sceneGesture.current.length && lookupStarted.current) {
          lookupController.current?.abort();
          lookupStarted.current = false;
          lastDetectedWord.current = undefined;
        }
        sceneGesture.current = points;
        window.clearTimeout(lookupTimer.current);
        const nextCandidate = detectWordGesture(elements, points);
        if (nextCandidate?.kind === "circle") {
          lookupTimer.current = window.setTimeout(() => {
            if (nextCandidate.word) publishCandidate(nextCandidate);
            else if (nextCandidate.confidence >= 75) void readGestureImage(nextCandidate);
          }, 150);
        }
      }
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void saveBoard(elements, files);
      }, 500);
    },
    [publishCandidate, readGestureImage],
  );
  const handlePointerDown = useCallback((activeTool: AppState["activeTool"]) => {
    penActive.current = activeTool.type === "freedraw";
    if (!penActive.current) return;
    window.clearTimeout(lookupTimer.current);
    lookupController.current?.abort();
    lookupStarted.current = false;
    gestureActive.current = true;
    setDrawing(true);
    sceneGesture.current = [];
    definitionController.current?.abort();
    setLearning((current) => (current?.result ? current : null));
    if (toastId.current && toast.getState().toasts.some((item) => item.type === "loading")) {
      toast.dismiss(toastId.current);
      setLearning(null);
    }
    lastDetectedWord.current = undefined;
    toastId.current = null;
  }, []);
  const handlePointerUp = useCallback(
    (activeTool: AppState["activeTool"]) => {
      if (activeTool.type !== "freedraw" || !penActive.current || !gestureActive.current) return;
      window.clearTimeout(lookupTimer.current);
      const nextCandidate = detectWordGesture(sceneElements.current, sceneGesture.current);
      if (nextCandidate) {
        publishCandidate(nextCandidate);
        void readGestureImage(nextCandidate);
      }
      gestureActive.current = false;
      setDrawing(false);
      sceneGesture.current = [];
    },
    [publishCandidate, readGestureImage],
  );

  useEffect(() => {
    toast.configure({ held: "replace" });
    return () => {
      window.clearTimeout(saveTimer.current);
      window.clearTimeout(lookupTimer.current);
      lookupController.current?.abort();
      definitionController.current?.abort();
      toast.dismiss();
    };
  }, []);

  return (
    <>
      <main className="app-shell">
        <section className="canvas-stage" aria-label="Whiteboard canvas">
          <Excalidraw
            initialData={initialData}
            langCode="vi-VN"
            excalidrawAPI={(api) => {
              excalidraw.current = api;
            }}
            renderTopRightUI={(isMobile) => (
              <button
                type="button"
                className={`help-icon canvas-help-button${isMobile ? " canvas-help-button--mobile" : ""}`}
                aria-label="Phím tắt"
                title="Phím tắt (?)"
                onClick={() =>
                  excalidraw.current?.updateScene({ appState: { openDialog: { name: "help" } } })
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01" />
                </svg>
              </button>
            )}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onChange={handleChange}
          />
        </section>
      </main>
      <WordToaster
        lesson={learning}
        drawing={drawing}
        onWord={loadWord}
        onClose={() => {
          definitionController.current?.abort();
          window.speechSynthesis?.cancel();
          setLearning(null);
        }}
      />
    </>
  );
}

export default App;
