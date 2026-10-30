const STOPWORDS = new Set([
  "a",
  "al",
  "de",
  "del",
  "el",
  "en",
  "es",
  "la",
  "las",
  "lo",
  "los",
  "mi",
  "para",
  "por",
  "que",
  "se",
  "su",
  "un",
  "una",
  "y",
  "ya",
  "pide",
  "piden",
  "solicita",
  "solicitan",
  "favor",
  "hay",
  "tengo",
  "tenemos",
]);

function words(value: string): Set<string> {
  return new Set(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\bloza\b/g, "losa")
      .match(/[a-z0-9]+/g)
      ?.filter((word) => word.length > 2 && !STOPWORDS.has(word)) ?? [],
  );
}

/** Conservative lexical guard for a recently opened ticket by the same actor and unit. */
export function isLikelySameTicket(first: string, second: string): boolean {
  const plain = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  if (plain(first).length >= 5 && plain(first) === plain(second)) return true;
  const left = words(first);
  const right = words(second);
  if (left.size < 3 || right.size < 3) return false;
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared >= 3 && shared / Math.min(left.size, right.size) >= 0.7;
}
