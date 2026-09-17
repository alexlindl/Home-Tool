/**
 * Pure helper for parsing free-form recipe text pasted from other sources
 * into the fields the RecipeForm uses. This is intentionally forgiving: the
 * user can edit anything after parsing, so heuristics only need to get close.
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
const STEPS_HEADING = /^(steps?|instructions?|directions?|method)\s*:?\s*$/i;

/**
 * Split a bullet/numbered ingredient line into an optional leading quantity and
 * a name. e.g. "2 cups flour" -> { quantity: "2 cups", name: "flour" }.
 * Lines without a recognizable leading measure are treated as all-name.
 */
export const splitIngredientLine = (raw: string): ParsedIngredient => {
  const line = raw.replace(/^[-*•\d.)\s]+/, '').trim();
  if (line.length === 0) return { name: '' };

  // Match a leading quantity: number (incl. fractions/decimals) plus an
  // optional unit word, e.g. "2", "1/2", "1.5 cups", "3 tbsp".
  const match = line.match(
    /^((?:\d+\s*\/\s*\d+|\d+(?:\.\d+)?)(?:\s*[a-zA-Z.]+)?)\s+(.*)$/,
  );
  if (match && match[2] && match[2].trim().length > 0) {
    return { quantity: match[1]!.trim(), name: match[2].trim() };
  }
  return { name: line };
};

/**
 * Parse pasted recipe text. Recognizes optional "Ingredients:" and
 * "Steps:/Instructions:/Directions:/Method:" section headings. Content before
 * any heading is treated as the name (first non-empty line) and summary
 * (subsequent lines up to the first heading).
 */
export const parseRecipeText = (text: string): ParsedRecipe => {
  const result: ParsedRecipe = { name: '', summary: '', ingredients: [], steps: [] };
  if (!text || text.trim().length === 0) return result;

  const lines = text.split(/\r?\n/);
  type Section = 'header' | 'ingredients' | 'steps';
  let section: Section = 'header';

  const headerLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (INGREDIENT_HEADING.test(line)) {
      section = 'ingredients';
      continue;
    }
    if (STEPS_HEADING.test(line)) {
      section = 'steps';
      continue;
    }

    if (line.length === 0) {
      // Blank lines separate header name/summary but are ignored elsewhere.
      continue;
    }

    if (section === 'header') {
      headerLines.push(line);
    } else if (section === 'ingredients') {
      const ingredient = splitIngredientLine(line);
      if (ingredient.name.length > 0) result.ingredients.push(ingredient);
    } else {
      // steps — strip any leading list marker/number
      const step = line.replace(/^[-*•\d.)\s]+/, '').trim();
      if (step.length > 0) result.steps.push(step);
    }
  }

  if (headerLines.length > 0) {
    result.name = headerLines[0]!;
    if (headerLines.length > 1) {
      result.summary = headerLines.slice(1).join(' ');
    }
  }

  return result;
};
