// Live word count for the status bar, using packages/texcount.
// texcount.js is a UMD script: imported for its side effect, it sets
// self.LibreTeXCount in the browser.
import '../../../packages/texcount/texcount.js';

export type CountResult = {
  sum: number; text: number; headerWords: number; captionWords: number; otherWords: number;
  abstractWords: number; headers: number; floats: number; inlineMath: number; displayMath: number;
};

declare global { interface Window { LibreTeXCount: { count: (src: string, opts?: object) => CountResult } } }

export function countWords(latex: string): CountResult {
  return self.LibreTeXCount.count(latex);
}

/** The short summary shown in the status bar. */
export function formatCount(r: CountResult): string {
  // abstractWords is already inside text, so it isn't added again.
  const { sum, text, captionWords, headerWords } = r;
  const n = (x: number) => x.toLocaleString();
  return `${n(sum)} total words, ${n(text + captionWords)} words (using TeXCount), ${n(headerWords)} words in headings`;
}
