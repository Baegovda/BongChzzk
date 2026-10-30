export function chunkTexts(texts, maxItems = 30, maxChars = 4500) {
  const chunks = [];
  let current = [];
  let chars = 0;
  for (const text of texts) {
    const len = text.length;
    if (current.length > 0 && (current.length >= maxItems || chars + len > maxChars)) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(text);
    chars += len;
  }
  if (current.length) chunks.push(current);
  return chunks;
}
