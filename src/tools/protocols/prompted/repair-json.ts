/**
 * One cheap repair pass over almost-JSON produced by a small model.
 *
 * Deliberately limited to the two failures that actually dominate in practice: prose
 * wrapped around the object, and trailing commas. Anything cleverer (quote rewriting,
 * key inference) risks turning a malformed call into a plausible wrong one, which is far
 * worse than reporting a parse failure the model can retry.
 *
 * Returns undefined when the text is beyond this level of help.
 */
export function repairJson(text: string): string | undefined {
  const balanced = extractBalancedObject(text);
  if (balanced === undefined) return undefined;

  const withoutTrailingCommas = balanced.replace(/,(\s*[}\]])/g, "$1");
  return withoutTrailingCommas === text ? undefined : withoutTrailingCommas;
}

/** The first brace-balanced `{...}` substring, ignoring braces inside strings. */
function extractBalancedObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index++) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return undefined;
}
