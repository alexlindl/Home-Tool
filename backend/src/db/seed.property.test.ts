import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Property-based tests for seed.ts data correctness.
 * Validates the 7 correctness properties from the design document.
 */

// =============================================================================
// Extract seed data by importing the module's source directly.
// We parse the file to extract data arrays since the module has side-effect
// functions that require a DB connection. Instead, we read the file as text.
// =============================================================================

const seedFilePath = path.join(__dirname, 'seed.ts');
const seedContent = fs.readFileSync(seedFilePath, 'utf8');

// Extract task templates from seed.ts
function extractTaskTemplates(): { title: string; description: string }[] {
  const fnMatch = seedContent.match(
    /const seedTaskTemplates[\s\S]*?const templates = \[([\s\S]*?)\];/
  );
  if (!fnMatch) throw new Error('Could not find task templates in seed.ts');
  const arrayContent = fnMatch[1];
  const entries: { title: string; description: string }[] = [];
  const regex = /\{\s*title:\s*'([^']+)',\s*description:\s*'([^']+)'\s*\}/g;
  let match;
  while ((match = regex.exec(arrayContent)) !== null) {
    entries.push({ title: match[1], description: match[2] });
  }
  return entries;
}

// Extract item templates from seed.ts
function extractItemTemplates(): { name: string; category: string }[] {
  const fnMatch = seedContent.match(
    /const seedItemTemplates[\s\S]*?const templates = \[([\s\S]*?)\];/
  );
  if (!fnMatch) throw new Error('Could not find item templates in seed.ts');
  const arrayContent = fnMatch[1];
  const entries: { name: string; category: string }[] = [];
  const regex = /\{\s*name:\s*'([^']+)',\s*category:\s*'([^']+)'\s*\}/g;
  let match;
  while ((match = regex.exec(arrayContent)) !== null) {
    entries.push({ name: match[1], category: match[2] });
  }
  return entries;
}

const taskTemplates = extractTaskTemplates();
const itemTemplates = extractItemTemplates();

// =============================================================================
// Reference data from migration 004
// =============================================================================

const migration004TaskTitles = [
  'Vacuum Living Room',
  'Vacuum Bedrooms',
  'Mop Kitchen Floor',
  'Clean Bathrooms',
  'Do the Dishes',
  'Laundry',
  'Iron Clothes',
  'Take Out Bins',
  'Mow the Lawn',
  'Tidy Up',
  'Change Bed Sheets',
  'Clean Windows',
  'Dust Surfaces',
  'Clean Oven',
  'Food Shop',
];

const migration004Items: { name: string; category: string }[] = [
  // Produce
  { name: 'Bananas', category: 'produce' },
  { name: 'Apples', category: 'produce' },
  { name: 'Potatoes', category: 'produce' },
  { name: 'Onions', category: 'produce' },
  { name: 'Carrots', category: 'produce' },
  { name: 'Tomatoes', category: 'produce' },
  { name: 'Cucumber', category: 'produce' },
  { name: 'Lettuce', category: 'produce' },
  { name: 'Mushrooms', category: 'produce' },
  { name: 'Peppers', category: 'produce' },
  { name: 'Broccoli', category: 'produce' },
  { name: 'Garlic', category: 'produce' },
  // Dairy
  { name: 'Milk', category: 'dairy' },
  { name: 'Butter', category: 'dairy' },
  { name: 'Cheese', category: 'dairy' },
  { name: 'Eggs', category: 'dairy' },
  { name: 'Yoghurt', category: 'dairy' },
  { name: 'Cream', category: 'dairy' },
  // Bakery
  { name: 'Bread', category: 'bakery' },
  { name: 'Rolls', category: 'bakery' },
  { name: 'Wraps', category: 'bakery' },
  { name: 'Crumpets', category: 'bakery' },
  // Meat
  { name: 'Chicken Breasts', category: 'meat' },
  { name: 'Mince Beef', category: 'meat' },
  { name: 'Bacon', category: 'meat' },
  { name: 'Sausages', category: 'meat' },
  { name: 'Salmon Fillets', category: 'meat' },
  // Frozen
  { name: 'Fish Fingers', category: 'frozen' },
  { name: 'Frozen Peas', category: 'frozen' },
  { name: 'Chips', category: 'frozen' },
  { name: 'Pizza', category: 'frozen' },
  { name: 'Ice Cream', category: 'frozen' },
  // Pantry
  { name: 'Pasta', category: 'pantry' },
  { name: 'Rice', category: 'pantry' },
  { name: 'Tinned Tomatoes', category: 'pantry' },
  { name: 'Baked Beans', category: 'pantry' },
  { name: 'Cereal', category: 'pantry' },
  { name: 'Cooking Oil', category: 'pantry' },
  { name: 'Flour', category: 'pantry' },
  { name: 'Sugar', category: 'pantry' },
  { name: 'Tea Bags', category: 'pantry' },
  { name: 'Coffee', category: 'pantry' },
  { name: 'Salt', category: 'pantry' },
  { name: 'Pepper', category: 'pantry' },
  // Drinks
  { name: 'Orange Juice', category: 'drinks' },
  { name: 'Squash', category: 'drinks' },
  { name: 'Fizzy Water', category: 'drinks' },
  // Snacks
  { name: 'Crisps', category: 'snacks' },
  { name: 'Biscuits', category: 'snacks' },
  { name: 'Chocolate', category: 'snacks' },
  // Household
  { name: 'Kitchen Roll', category: 'household' },
  { name: 'Toilet Roll', category: 'household' },
  { name: 'Bin Bags', category: 'household' },
  { name: 'Washing Up Liquid', category: 'household' },
  { name: 'Laundry Detergent', category: 'household' },
  { name: 'Dishwasher Tablets', category: 'household' },
  { name: 'Surface Cleaner', category: 'household' },
  { name: 'Sponges', category: 'household' },
  { name: 'Cling Film', category: 'household' },
  { name: 'Foil', category: 'household' },
  // Toiletries
  { name: 'Shampoo', category: 'toiletries' },
  { name: 'Shower Gel', category: 'toiletries' },
  { name: 'Toothpaste', category: 'toiletries' },
  { name: 'Deodorant', category: 'toiletries' },
];

const petItemNames = [
  'Dog Food',
  'Dog Treats',
  'Poo Bags',
  'Dog Chews',
  'Cat Food',
  'Cat Treats',
  'Cat Litter',
  'Litter Liners',
  'Flea Treatment',
  'Worming Tablets',
];

const petTaskTitles = [
  'Walk the Dog',
  'Feed the Dog',
  'Brush the Dog',
  'Dog Flea Treatment',
  'Dog Worming',
  'Feed the Cat',
  'Clean Litter Tray',
  'Cat Flea Treatment',
  'Cat Worming',
  'Book Vet Appointment',
];

const americanTerms = ['trash', 'yard', 'sanitize', 'garbage', 'deworming', 'poop'];

// =============================================================================
// Property 1: Task template completeness
// =============================================================================
describe('Property 1: Task template completeness', () => {
  it('every migration 004 task title exists in the seed task templates', () => {
    const seedTitles = new Set(taskTemplates.map((t) => t.title));
    fc.assert(
      fc.property(fc.constantFrom(...migration004TaskTitles), (title) => {
        expect(seedTitles.has(title)).toBe(true);
      })
    );
  });
});

// =============================================================================
// Property 2: Item template completeness with correct categories
// =============================================================================
describe('Property 2: Item template completeness with correct categories', () => {
  it('every migration 004 item exists in the seed with matching category', () => {
    const seedItemMap = new Map(itemTemplates.map((i) => [i.name, i.category]));
    fc.assert(
      fc.property(fc.constantFrom(...migration004Items), (item) => {
        expect(seedItemMap.has(item.name)).toBe(true);
        expect(seedItemMap.get(item.name)).toBe(item.category);
      })
    );
  });
});

// =============================================================================
// Property 3: Pet items assigned to pet category
// =============================================================================
describe('Property 3: Pet items assigned to pet category', () => {
  it('every pet item has category "pet"', () => {
    const seedItemMap = new Map(itemTemplates.map((i) => [i.name, i.category]));
    fc.assert(
      fc.property(fc.constantFrom(...petItemNames), (name) => {
        expect(seedItemMap.has(name)).toBe(true);
        expect(seedItemMap.get(name)).toBe('pet');
      })
    );
  });
});

// =============================================================================
// Property 4: Pet task templates have descriptions
// =============================================================================
describe('Property 4: Pet task templates have descriptions', () => {
  it('every pet task template has a non-empty description', () => {
    const seedTaskMap = new Map(taskTemplates.map((t) => [t.title, t.description]));
    fc.assert(
      fc.property(fc.constantFrom(...petTaskTitles), (title) => {
        expect(seedTaskMap.has(title)).toBe(true);
        const desc = seedTaskMap.get(title)!;
        expect(desc.length).toBeGreaterThan(0);
      })
    );
  });
});

// =============================================================================
// Property 5: No Americanisms in templates
// =============================================================================
describe('Property 5: No Americanisms in templates', () => {
  const allStrings = [
    ...taskTemplates.map((t) => t.title),
    ...taskTemplates.map((t) => t.description),
    ...itemTemplates.map((i) => i.name),
  ];

  it('no template text contains American-English blocked terms', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allStrings), (text) => {
        const lower = text.toLowerCase();
        for (const term of americanTerms) {
          expect(lower).not.toContain(term);
        }
        // Special case: "yogurt" without 'h' (should be "yoghurt")
        if (lower.includes('yogurt') && !lower.includes('yoghurt')) {
          fail(`Found "yogurt" without "h" in: ${text}`);
        }
      })
    );
  });
});

// =============================================================================
// Property 6: No duplicates in template arrays
// =============================================================================
describe('Property 6: No duplicates in template arrays', () => {
  it('task template titles are unique', () => {
    const titles = taskTemplates.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('item template names are unique', () => {
    const names = itemTemplates.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// =============================================================================
// Property 7: File copies are identical
// =============================================================================
describe('Property 7: File copies are identical', () => {
  it('backend/src/db/seed.ts and household-management/backend-src/db/seed.ts are byte-equal', () => {
    const backendPath = path.resolve(__dirname, 'seed.ts');
    const householdPath = path.resolve(
      __dirname,
      '../../../household-management/backend-src/db/seed.ts'
    );
    const backendContent = fs.readFileSync(backendPath);
    const householdContent = fs.readFileSync(householdPath);
    expect(Buffer.compare(backendContent, householdContent)).toBe(0);
  });
});
