/**
 * CJK & Multilingual Tokenizer for BM25 Sparse Retrieval.
 *
 * 1. Strips punctuation and normalizes whitespace.
 * 2. Applies character-level unigram segmentation for strings containing CJK characters
 *    (Chinese Hanzi, Japanese Hiragana/Katakana/Kanji, Korean Hangul) as a zero-dependency
 *    deterministic fallback.
 * 3. Uses standard lowercase whitespace splitting for Latin/Cyrillic scripts.
 */

const CJK_DETECTION_REGEX = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;
const CJK_CHAR_REGEX = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/u;

export function tokenizeCJK(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // 1. Remove punctuation and normalize whitespace
  const cleaned = text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length === 0) {
    return [];
  }

  const normalized = cleaned.toLowerCase();

  // 2. If CJK characters are present, apply character-level unigram segmentation for CJK
  //    while preserving contiguous Latin/Cyrillic/numeric words.
  if (CJK_DETECTION_REGEX.test(normalized)) {
    const tokens: string[] = [];
    const words = normalized.split(/\s+/);

    for (const word of words) {
      if (!word) continue;
      if (!CJK_DETECTION_REGEX.test(word)) {
        tokens.push(word);
        continue;
      }

      let nonCjkBuffer = '';
      for (const char of word) {
        if (CJK_CHAR_REGEX.test(char)) {
          if (nonCjkBuffer.length > 0) {
            tokens.push(nonCjkBuffer);
            nonCjkBuffer = '';
          }
          tokens.push(char);
        } else {
          nonCjkBuffer += char;
        }
      }
      if (nonCjkBuffer.length > 0) {
        tokens.push(nonCjkBuffer);
      }
    }

    return tokens;
  }

  // 3. Standard Latin/Cyrillic tokenization
  return normalized.split(/\s+/).filter(Boolean);
}
