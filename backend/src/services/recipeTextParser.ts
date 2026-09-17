/**
 * Pure helper for parsing free-form recipe text pasted from other sources
 * into the fields the RecipeForm uses. This is intentionally forgiving: the
 * user can edit anything after parsing, so heuristics only need to get close.
 *
 * It works in two modes:
 *  - Heading mode: if the text has "Ingredients:" / "Steps:" (or similar)
 *    headings, sections are split on those.
 *  - Heuristic mode: when there are no headings (common when copying from a
 *    recipe website), each line is classified as an ingredient or a step by
 *    shape — ingredient lines tend to start with a quantity (number, fraction,
 *    or unicode fraction) and are short; step lines are longer sentences.
 */

export interface ParsedIngredient {
  name: string;
  quantity?: string;
}

export interface ParsedRecipe {
  name: string;
  summary: string;
  ingredients: ParsedIngredient[];
  steps: string[];
}

const INGREDIENT_HEADING = /^(ingredients?)\s*:?\s*$/i;
const STEPS_HEADING = /^(steps?|instructions?|directions?|method|preparation)\s*:?\s*$/i;

// Unicode vulgar fractions that commonly appear in ingredient amounts.
const UNICODE_FRACTIONS = '¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞';

// A leading amount: a number (int/decimal/fraction) or unicode fraction,
// optionally followed by another (e.g. "1 1/2") and/or a unit word.
const LEADING_AMOUNT = new RegExp(
  `^(` +
    `(?:\\d+\\s+)?\\d+\\s*/\\s*\\d+` + // "1 1/2" or "1/2"
    `|\\d+(?:\\.\\d+)?` + // "2" or "1.5"
    `|[${UNICODE_FRACTIONS}]` + // "½"
    `|\\d+\\s*[${UNICODE_FRACTIONS}]` + // "1½"
  `)(?:\\s*[a-zA-Z.]+)?\\s+(.*)$`,
);

// Common cooking measure words — a strong signal a line is an ingredient.
const MEASURE_WORDS =
  /\b(cups?|cup|tsp|teaspoons?|tbsp|tablespoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|litres?|cloves?|cans?|packages?|pkg|sticks?|pinch|dash|quarts?|pints?|gallons?)\b/i;

/**
 * Split an ingredient line into an optional leading quantity and a name.
 * e.g. "2 cups flour" -> { quantity: "2 cups", name: "flour" }.
 * Lines without a recognizable leading measure are treated as all-name.
 */
export const splitIngredientLine = (raw: string): ParsedIngredient => {
  const cleaned = raw.replace(/^[-*•·]\s*/, '').trim();
  if (cleaned.length === 0) return { name: '' };

  // Match the bare number/fraction amount first (no unit).
  const amountMatch = cleaned.match(
    new RegExp(
      `^(` +
        `(?:\\d+\\s+)?\\d+\\s*/\\s*\\d+` +
        `|\\d+(?:\\.\\d+)?\\s*[${UNICODE_FRACTIONS}]?` +
        `|[${UNICODE_FRACTIONS}]` +
      `)\\s+(.*)$`,
    ),
  );
  if (!amountMatch || !amountMatch[2]) {
    return { name: cleaned };
  }

  let quantity = amountMatch[1]!.trim();
  let rest = amountMatch[2].trim();

  // If the word right after the amount is a known measure (cups, tsp, ...),
  // fold it into the quantity; otherwise leave it as part of the name so we
  // don't swallow descriptors like "large" in "3 large eggs".
  const restMatch = rest.match(/^(\S+)\s+(.*)$/);
  if (restMatch && restMatch[1] && MEASURE_WORDS.test(restMatch[1])) {
    quantity = `${quantity} ${restMatch[1]}`;
    rest = restMatch[2]!.trim();
  }

  return rest.length > 0 ? { quantity, name: rest } : { name: cleaned };
};

/**
 * Heuristic: does this line look like an ingredient (vs a step)?
 * True when it starts with an amount or contains a measure word and is short.
 */
const looksLikeIngredient = (line: string): boolean => {
  const stripped = line.replace(/^[-*•·]\s*/, '');
  if (LEADING_AMOUNT.test(stripped)) return true;
  if (MEASURE_WORDS.test(stripped) && stripped.length <= 80) return true;
  return false;
};

/**
 * Heuristic: does this line look like a step? Longer sentences, or lines that
 * start with a step number like "1." / "Step 1".
 */
const looksLikeStep = (line: string): boolean => {
  if (/^step\s*\d+/i.test(line)) return true;
  if (/^\d+[.)]\s+\S/.test(line) && line.length > 40) return true;
  // Long sentence with spaces = probably an instruction.
  return line.length > 60 && /\s/.test(line);
};

/**
 * Strip a leading list/step marker for step text.
 */
const stripStepMarker = (line: string): string =>
  line.replace(/^(step\s*\d+\s*[:.)-]?\s*|\d+[.)]\s*|[-*•·]\s*)/i, '').trim();

/**
 * Parse pasted recipe text into fields. Uses heading mode when headings are
 * present, otherwise classifies lines heuristically.
 */
export const parseRecipeText = (text: string): ParsedRecipe => {
  const result: ParsedRecipe = { name: '', summary: '', ingredients: [], steps: [] };
  if (!text || text.trim().length === 0) return result;

  const rawLines = text.split(/\r?\n/).map((l) => l.trim());
  const lines = rawLines.filter((l) => l.length > 0);
  if (lines.length === 0) return result;

  const hasHeadings = lines.some(
    (l) => INGREDIENT_HEADING.test(l) || STEPS_HEADING.test(l),
  );

  // Treat the first line as the recipe name only when it reads like a title
  // rather than an ingredient or a step. This avoids turning a leading
  // "2 cups flour" (common when copying straight from a site) into the name.
  const firstLine = lines[0] ?? '';
  const firstLineIsTitle =
    hasHeadings || (!looksLikeIngredient(firstLine) && !looksLikeStep(firstLine));

  let body: string[];
  if (firstLineIsTitle) {
    result.name = firstLine;
    body = lines.slice(1);
  } else {
    result.name = '';
    body = lines;
  }

  if (hasHeadings) {
    type Section = 'header' | 'ingredients' | 'steps';
    let section: Section = 'header';
    const summaryLines: string[] = [];

    for (const line of body) {
      if (INGREDIENT_HEADING.test(line)) {
        section = 'ingredients';
        continue;
      }
      if (STEPS_HEADING.test(line)) {
        section = 'steps';
        continue;
      }
      if (section === 'header') {
        summaryLines.push(line);
      } else if (section === 'ingredients') {
        const ing = splitIngredientLine(line);
        if (ing.name.length > 0) result.ingredients.push(ing);
      } else {
        const step = stripStepMarker(line);
        if (step.length > 0) result.steps.push(step);
      }
    }
    result.summary = summaryLines.join(' ');
    return result;
  }

  // Heuristic mode (no headings). Classify each body line.
  const summaryLines: string[] = [];
  let seenStructured = false;

  for (const line of body) {
    if (looksLikeIngredient(line)) {
      seenStructured = true;
      const ing = splitIngredientLine(line);
      if (ing.name.length > 0) result.ingredients.push(ing);
    } else if (looksLikeStep(line)) {
      seenStructured = true;
      const step = stripStepMarker(line);
      if (step.length > 0) result.steps.push(step);
    } else if (!seenStructured) {
      // Preamble before we hit any structured content becomes the summary.
      summaryLines.push(line);
    } else {
      // Short trailing/among-content line that isn't clearly an ingredient:
      // attach to steps if we've started steps, else treat as an ingredient.
      if (result.steps.length > 0) {
        result.steps.push(stripStepMarker(line));
      } else {
        const ing = splitIngredientLine(line);
        if (ing.name.length > 0) result.ingredients.push(ing);
      }
    }
  }

  result.summary = summaryLines.join(' ');
  return result;
};
