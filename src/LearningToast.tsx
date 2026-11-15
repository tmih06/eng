import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { VocabularyResult, WordImage } from "../shared/vocabulary";

const markdownElements = [
  "p",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "hr",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
];

export interface LearningState {
  word: string;
  result: VocabularyResult | null;
  error: string | null;
}

export function LearningToast({
  state,
  onWord,
}: {
  state: LearningState;
  onWord: (word: string) => void;
}) {
  const [image, setImage] = useState<WordImage | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const { word, result, error } = state;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setImage(null);
    setImageFailed(false);
    const loadImage = async () => {
      try {
        const response = await fetch(`/api/word-image?word=${encodeURIComponent(word)}`, {
          signal: controller.signal,
        });
        const value = response.ok ? ((await response.json()) as WordImage | null) : null;
        if (active) setImage(value);
      } catch {
        // Images are optional; keep the lesson usable if the source is unavailable.
      }
    };
    void loadImage();
    return () => {
      active = false;
      controller.abort();
    };
  }, [word]);
  return (
    <div className="learning-content" aria-label={`Học từ ${word}`} lang="vi">
      <header className="learning-toast-heading">
        <div>
          {result && (
            <span className="learning-meta">
              {result.phonetic} {result.phonetic && "·"} {result.partOfSpeech}
            </span>
          )}
        </div>
      </header>
      <div aria-live="polite" aria-busy={!result && !error}>
        {!result && !error && (
          <p className="learning-loading">Đang soạn giải thích bằng tiếng Việt…</p>
        )}
        {error && (
          <p className="learning-notice" role="alert">
            {error}
          </p>
        )}
        {result && (
          <>
            <section className="learning-section learning-markdown">
              <h3>Nghĩa & cách dùng</h3>
              <ReactMarkdown skipHtml allowedElements={markdownElements}>
                {result.meaningMarkdown}
              </ReactMarkdown>
            </section>
            <section className="learning-section learning-example learning-markdown">
              <h3>Ví dụ thực tế</h3>
              <ReactMarkdown skipHtml allowedElements={markdownElements}>
                {result.exampleMarkdown}
              </ReactMarkdown>
            </section>
            <section className="learning-section">
              <h3>Từ gần nghĩa & liên quan</h3>
              <div className="similar-words">
                {result.similarWords.map((similar) => (
                  <button type="button" key={similar} onClick={() => onWord(similar)} lang="en">
                    {similar} ↗
                  </button>
                ))}
              </div>
            </section>
            <p className="learning-disclaimer">
              Giải thích do AI hỗ trợ. Nghĩa của từ có thể thay đổi theo ngữ cảnh.
            </p>
          </>
        )}
      </div>
      <section className="learning-section">
        <h3>Hình ảnh minh họa</h3>
        {image && !imageFailed ? (
          <figure className="learning-figure">
            <img
              className="learning-image"
              src={image.url}
              alt={`Minh họa: ${image.title}`}
              onError={() => setImageFailed(true)}
            />
            <figcaption>
              <a href={image.pageUrl} target="_blank" rel="noreferrer">
                {image.title} · Wikipedia / Wikimedia — nguồn & giấy phép ↗
              </a>
            </figcaption>
          </figure>
        ) : (
          <div className="learning-image-placeholder">Hình ảnh không khả dụng cho từ này.</div>
        )}
      </section>
    </div>
  );
}
