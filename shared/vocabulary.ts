export interface VocabularyResult {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  usageNotes: string[];
  example: {
    english: string;
    vietnamese: string;
  };
  similarWords: string[];
}

export interface WordImage {
  url: string;
  pageUrl: string;
  title: string;
}
