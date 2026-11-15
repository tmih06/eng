export interface RecognizedWord {
  word: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrResponse {
  word: string;
  contextSentence: string;
}
