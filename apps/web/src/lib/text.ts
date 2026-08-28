const SMALL_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "but",
  "or",
  "nor",
  "for",
  "yet",
  "so",
  "at",
  "by",
  "in",
  "of",
  "on",
  "to",
  "up",
  "as",
  "is",
  "if",
  "via",
  "per",
  "vs",
  "with",
  "from",
  "when",
  "not",
]);

/** Title Case for UI labels; keeps small words lowercase unless first/last. */
export function toTitleCase(text: string): string {
  const words = text.trim().split(/\s+/);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      const isEdge = index === 0 || index === words.length - 1;
      if (!isEdge && SMALL_WORDS.has(lower)) return lower;
      if (/^[(\[]/.test(word)) {
        const prefix = word.match(/^[(\[]+/)?.[0] ?? "";
        const core = word.slice(prefix.length);
        return prefix + capitalizeWord(core);
      }
      return capitalizeWord(word);
    })
    .join(" ");
}

function capitalizeWord(word: string): string {
  if (!word) return word;
  const trailing = word.match(/[.,!?;:…]+$/)?.[0] ?? "";
  const core = trailing ? word.slice(0, -trailing.length) : word;
  if (!core) return word;
  return core.charAt(0).toUpperCase() + core.slice(1).toLowerCase() + trailing;
}

export function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function formatStatus(status: string): string {
  if (!status || status === "—") return status;
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
