import { useEffect, useRef, useState } from "react";

export function PronunciationButton({ word }: { word: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  useEffect(
    () => () => {
      const current = audio.current;
      audio.current = null;
      if (current) {
        current.onended = null;
        current.onerror = null;
        current.onplaying = null;
        current.pause();
        current.removeAttribute("src");
        current.load();
      }
      window.speechSynthesis?.cancel();
    },
    [word],
  );
  const play = () => {
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    setStatus("loading");
    const recording = new Audio(`/api/pronunciation?word=${encodeURIComponent(word)}`);
    audio.current = recording;
    const fallback = () => {
      if (audio.current !== recording) return;
      const synthesis = window.speechSynthesis;
      const voice = synthesis?.getVoices().find((voice) => voice.lang.startsWith("en"));
      if (!voice) {
        setStatus("error");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 0.85;
      utterance.onstart = () => {
        if (audio.current === recording) setStatus("playing");
      };
      utterance.onend = () => {
        if (audio.current === recording) setStatus("idle");
      };
      utterance.onerror = (event) => {
        if (
          audio.current === recording &&
          event.error !== "canceled" &&
          event.error !== "interrupted"
        )
          setStatus("error");
      };
      synthesis.speak(utterance);
    };
    let failed = false;
    const fail = () => {
      if (!failed) {
        failed = true;
        fallback();
      }
    };
    recording.onplaying = () => {
      if (audio.current === recording) setStatus("playing");
    };
    recording.onended = () => {
      if (audio.current === recording) setStatus("idle");
    };
    recording.onerror = fail;
    // Start playback directly from the click, preserving browser user activation.
    void recording.play().catch(fail);
  };
  return (
    <span className="pronunciation-control">
      <button
        type="button"
        className="pronunciation-button"
        onClick={play}
        aria-label={`Nghe phát âm ${word}`}
        title={status === "loading" ? "Đang tải phát âm…" : "Nghe phát âm"}
        aria-busy={status === "loading"}
        aria-pressed={status === "playing"}
      >
        <svg
          viewBox="0 0 24 24"
          width="19"
          height="19"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
        </svg>
      </button>
      {status === "error" && (
        <span className="pronunciation-error" role="status">
          Không phát được âm thanh. Hãy thử lại.
        </span>
      )}
    </span>
  );
}
