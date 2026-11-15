export interface VocabularyResult {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningMarkdown: string;
  exampleMarkdown: string;
  similarWords: string[];
}

export interface WordImage {
  url: string;
  pageUrl: string;
  title: string;
}
