import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import {
  bindToast,
  ICONS,
  injectStyles,
  onToastKey,
  toast,
  type ToastItem,
} from "@yusufceng1z/ding";
import { LearningToast, type LearningState } from "./LearningToast";
import { PronunciationButton } from "./PronunciationButton";

function WordNotification({
  item,
  lesson,
  onClose,
  onWord,
}: {
  item: ToastItem;
  lesson: LearningState | null;
  onClose: () => void;
  onWord: (word: string) => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = slot.current;
    if (!element) return;
    const stopMotion = bindToast(element, item.id);
    const body = element.querySelector<HTMLElement>(".tst-body");
    // Fit the whole toast on shorter screens without a nested scroll area.
    const fit = () => {
      const height = body?.offsetHeight ?? 44;
      element.style.zoom = String(Math.min(1, (window.innerHeight - 32) / height));
    };
    const observer = new ResizeObserver(fit);
    if (body) observer.observe(body);
    window.addEventListener("resize", fit);
    fit();
    return () => {
      stopMotion();
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [item.id]);
  const rich = item.className === "learning-notification" && lesson;
  return (
    <div ref={slot} className="tst-slot" tabIndex={-1} style={{ "--tst-i": 0 } as CSSProperties}>
      <div className={`tst ${item.className ?? ""}`} data-phase={item.phase} data-type={item.type}>
        <div className="tst-icon">
          <div className="tst-badge">
            <svg className="tst-svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              {ICONS[item.type].map((path) => (
                <path d={path} pathLength="1" key={path} />
              ))}
            </svg>
          </div>
        </div>
        <div className="tst-body">
          <div className="tst-copy">
            <div className="tst-title">
              {rich && (
                <span className="learning-eyebrow">
                  {lesson.word.includes(" ") ? "CỤM TỪ" : "TỪ VỰNG"} · EN / VI
                </span>
              )}
              <span className="learning-word-title">
                <span className="learning-word-text">{item.title}</span>
                {rich && <PronunciationButton key={lesson.word} word={lesson.word} />}
              </span>
            </div>
            <div className="tst-desc">
              {rich ? <LearningToast state={lesson} onWord={onWord} /> : item.description}
            </div>
          </div>
          <button
            type="button"
            className="tst-close"
            aria-label="Đóng thông báo"
            tabIndex={item.phase === "open" ? 0 : -1}
            onClick={() => {
              toast.dismiss(item.id);
              if (rich) onClose();
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export function WordToaster({
  lesson,
  drawing,
  onClose,
  onWord,
}: {
  lesson: LearningState | null;
  drawing: boolean;
  onClose: () => void;
  onWord: (word: string) => void;
}) {
  const state = useSyncExternalStore(toast.subscribe, toast.getState, toast.getState);
  useEffect(() => {
    injectStyles(document);
    toast.configure({
      position: "bottom-right",
      theme: "light",
      held: "replace",
      labels: { region: "Thông báo", dismiss: "Đóng thông báo" },
    });
    document.addEventListener("keydown", onToastKey);
    return () => document.removeEventListener("keydown", onToastKey);
  }, []);
  return (
    <div
      className="word-toaster"
      data-drawing={drawing}
      onPointerDownCapture={(event) => {
        if (event.target instanceof Element && event.target.closest(".learning-content"))
          event.stopPropagation();
      }}
    >
      <div
        className="tst-viewport"
        role="region"
        aria-label="Thông báo"
        data-position={state.position}
        data-theme={state.theme}
        onPointerEnter={() => toast.pause()}
        onPointerLeave={() => toast.resume()}
      >
        <div className="tst-sr" role="status">
          {state.status}
        </div>
        <div className="tst-sr" role="alert">
          {state.alert}
        </div>
        {state.toasts.map((item) => (
          <WordNotification
            key={item.id}
            item={item}
            lesson={lesson}
            onClose={onClose}
            onWord={onWord}
          />
        ))}
      </div>
    </div>
  );
}
