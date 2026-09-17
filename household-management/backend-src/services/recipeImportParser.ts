/**
 * Recipe import parser (pure, no network).
 *
 * Extracts a recipe from raw HTML by reading schema.org/Recipe structured data
 * embedded as JSON-LD (`<script type="application/ld+json">`). This is the
 * format that essentially every mainstream recipe site emits for Google's
 * recipe cards, so it gives broad coverage without any HTML scraping.
 *
 * When no JSON-LD Recipe is found, the caller falls back to the plain-text
 * recipe parser (parseRecipeText) run over the page text.
 */

export interface ImportedRecipe {
  name: string;
  summary: string;
  ingredients: { name: string; quantity?: string }[];
  steps: string[];
}

/**
 * Decode the most common HTML entities that appear in recipe text. Kept small
 * and dependency-free; covers named + numeric (decimal/hex) entities.
 */
export const decodeHtmlEntities = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
      const named: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: ' ',
        deg: '°',
        frac12: '½',
        frac14: '¼',
        frac34: '¾',
        eacute: 'é',
        egrave: 'è',
        agrave: 'à',
        uuml: 'ü',
        ouml: 'ö',
        auml: 'ä',
        ccedil: 'ç',
        ntilde: 'ñ',
        mdash: '—',
        ndash: '–',
        hellip: '…',
        rsquo: '\u2019',
        lsquo: '\u2018',
        rdquo: '\u201d',
        ldquo: '\u201c',
      };

      if (entity.startsWith('#')) {
        const isHex = entity[1] === 'x' || entity[1] === 'X';
        const codePoint = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (Number.isFinite(codePoint) && codePoint > 0) {
          try {
            return String.fromCodePoint(codePoint);
          } catch {
            return match;
          }
        }
        return match;
      }

      return named[entity] ?? match;
    });
};

/**
 * Strip HTML tags and collapse whitespace from a fragment of instruction text.
 */
const stripHtml = (input: string): string =>
  decodeHtmlEntities(String(input).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Split a schema.org quantity+name ingredient string into an optional leading
 * quantity and the ingredient name. Mirrors the paste parser's heuristic.
 */
export const splitIngredient = (raw: string): { name: string; quantity?: string } => {
  const line = stripHtml(raw);
  if (line.length === 0) return { name: '' };

  const match = line.match(
    /^((?:\d+\s*\/\s*\d+|\d+(?:\.\d+)?|[½¼¾⅓⅔⅛])(?:\s*[a-zA-Z.]+)?)\s+(.*)$/,
  );
  if (match && match[2] && match[2].trim().length > 0) {
    return { quantity: match[1]!.trim(), name: match[2].trim() };
  }
  return { name: line };
};

/**
 * Flatten schema.org recipeInstructions into an ordered array of step strings.
 * Handles the common shapes:
 *  - a plain string (possibly newline- or period-separated)
 *  - an array of strings
 *  - an array of HowToStep objects ({ text })
 *  - an array of HowToSection objects ({ itemListElement: [...] })
 */
export const flattenInstructions = (instructions: unknown): string[] => {
  const steps: string[] = [];

  const pushText = (value: unknown) => {
    if (typeof value === 'string') {
      const text = stripHtml(value);
      if (text.length > 0) steps.push(text);
    }
  };

  const handleNode = (node: unknown) => {
    if (node == null) return;
    if (typeof node === 'string') {
      pushText(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(handleNode);
      return;
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const type = String(obj['@type'] ?? '');
      if (type.includes('HowToSection') && obj.itemListElement) {
        handleNode(obj.itemListElement);
        return;
      }
      // HowToStep or generic object with a text/name field.
      if (typeof obj.text === 'string') {
        pushText(obj.text);
        return;
      }
      if (typeof obj.name === 'string') {
        pushText(obj.name);
        return;
      }
    }
  };

  if (typeof instructions === 'string') {
    // A single string blob — split on newlines or sentence boundaries.
    const cleaned = stripHtml(instructions);
    const parts = cleaned
      .split(/\r?\n|(?<=\.)\s+(?=[A-Z0-9])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return parts.length > 0 ? parts : cleaned.length > 0 ? [cleaned] : [];
  }

  handleNode(instructions);
  return steps;
};

/**
 * Collect every JSON object/array embedded in the page's JSON-LD script tags.
 */
const extractJsonLdBlocks = (html: string): unknown[] => {
  const blocks: unknown[] = [];
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1];
    if (!raw) continue;
    // Some sites emit invalid trailing characters or HTML comments; try to be lenient.
    const text = raw.replace(/^\s*<!--/, '').replace(/-->\s*$/, '').trim();
    try {
      blocks.push(JSON.parse(text));
    } catch {
      // Ignore blocks that are not valid JSON.
    }
  }
  return blocks;
};

/**
 * Determine whether a JSON-LD node represents a Recipe (its @type may be a
 * string or an array of strings).
 */
const isRecipeNode = (node: unknown): node is Record<string, unknown> => {
  if (!node || typeof node !== 'object') return false;
  const type = (node as Record<string, unknown>)['@type'];
  if (typeof type === 'string') return type.toLowerCase() === 'recipe';
  if (Array.isArray(type)) {
    return type.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe');
  }
  return false;
};

/**
 * Walk a JSON-LD value (which may be a graph, array, or single node) and return
 * the first Recipe node found.
 */
const findRecipeNode = (value: unknown): Record<string, unknown> | null => {
  if (value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    if (isRecipeNode(value)) return value as Record<string, unknown>;
    const obj = value as Record<string, unknown>;
    // schema.org graphs nest nodes under "@graph".
    if (obj['@graph']) {
      const found = findRecipeNode(obj['@graph']);
      if (found) return found;
    }
  }
  return null;
};

/**
 * Map a schema.org Recipe node to our ImportedRecipe shape.
 */
const mapRecipeNode = (node: Record<string, unknown>): ImportedRecipe => {
  const name = typeof node.name === 'string' ? stripHtml(node.name) : '';

  const description =
    typeof node.description === 'string' ? stripHtml(node.description) : '';

  const rawIngredients = node.recipeIngredient ?? node.ingredients;
  const ingredients = Array.isArray(rawIngredients)
    ? rawIngredients
        .map((ing) => splitIngredient(String(ing)))
        .filter((ing) => ing.name.length > 0)
    : [];

  const steps = flattenInstructions(node.recipeInstructions);

  return { name, summary: description, ingredients, steps };
};

/**
 * Parse recipe fields from raw HTML using embedded JSON-LD. Returns null when
 * no schema.org/Recipe structured data is present, so the caller can fall back
 * to text parsing.
 */
export const parseRecipeFromHtml = (html: string): ImportedRecipe | null => {
  if (!html) return null;
  const blocks = extractJsonLdBlocks(html);
  for (const block of blocks) {
    const node = findRecipeNode(block);
    if (node) {
      const recipe = mapRecipeNode(node);
      // Only accept when we got at least a name or some content.
      if (recipe.name || recipe.ingredients.length > 0 || recipe.steps.length > 0) {
        return recipe;
      }
    }
  }
  return null;
};

/**
 * Best-effort extraction of readable page text from HTML, used to feed the
 * plain-text fallback parser when no JSON-LD Recipe is available. Removes
 * script/style/head content and collapses tags to newlines.
 */
export const htmlToText = (html: string): string => {
  if (!html) return '';
  const withoutHead = html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

  // Convert block-level closings and <br> to newlines to preserve structure.
  const withBreaks = withoutHead
    .replace(/<\/(p|div|li|h[1-6]|section|article|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ');

  return decodeHtmlEntities(withBreaks.replace(/<[^>]*>/g, ' '))
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
};
