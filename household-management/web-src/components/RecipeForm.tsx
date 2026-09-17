/**
 * RecipeForm Component
 * Modal for creating or editing a recipe. Supports:
 *  - name + summary
 *  - a dynamic, reorderable-free list of steps
 *  - a dynamic list of ingredients (name, quantity, category)
 *  - a "paste / import" box that parses free-form recipe text into fields,
 *    so recipes can be copied in from other sources or written directly.
 */

import React, { useState, useEffect } from 'react';
import type {
  Recipe,
  CreateRecipeInput,
  RecipeIngredientInput,
} from '@/types';
import { recipeApi, categoryApi } from '@/services/api';
import { parseRecipeText } from './recipeParsing';

interface RecipeFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: (recipe: Recipe) => void;
  currentUserId: string;
  /** When provided, the form edits this recipe instead of creating a new one. */
  recipe?: Recipe | null;
}

interface EditableIngredient extends RecipeIngredientInput {
  key: string; // stable React key
}

let keyCounter = 0;
const nextKey = (): string => `ing-${keyCounter++}`;

export const RecipeForm: React.FC<RecipeFormProps> = ({
  open,
  onClose,
  onSaved,
  currentUserId,
  recipe,
}) => {
  const isEdit = Boolean(recipe);

  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [ingredients, setIngredients] = useState<EditableIngredient[]>([
    { key: nextKey(), name: '', quantity: '', category: '' },
  ]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Populate categories and, when editing, the recipe fields whenever opened.
  useEffect(() => {
    if (!open) return;

    categoryApi
      .getAll()
      .then((cats) => setCategories(cats.map((c) => c.name)))
      .catch(() => {});

    if (recipe) {
      setName(recipe.name);
      setSummary(recipe.summary ?? '');
      setSteps(recipe.steps.length > 0 ? [...recipe.steps] : ['']);
      setIngredients(
        recipe.ingredients.length > 0
          ? recipe.ingredients.map((ing) => ({
              key: nextKey(),
              name: ing.name,
              quantity: ing.quantity ?? '',
              category: ing.category ?? '',
            }))
          : [{ key: nextKey(), name: '', quantity: '', category: '' }],
      );
      setSourceUrl(recipe.sourceUrl);
    } else {
      setName('');
      setSummary('');
      setSteps(['']);
      setIngredients([{ key: nextKey(), name: '', quantity: '', category: '' }]);
      setSourceUrl(undefined);
    }
    setShowImport(false);
    setImportText('');
    setImportUrl('');
    setImportError('');
    setError('');
  }, [open, recipe]);

  // --- Step handlers -------------------------------------------------------
  const updateStep = (index: number, value: string) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));
  };
  const addStep = () => setSteps((prev) => [...prev, '']);
  const removeStep = (index: number) =>
    setSteps((prev) => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== index)));

  // --- Ingredient handlers -------------------------------------------------
  const updateIngredient = (
    key: string,
    field: keyof RecipeIngredientInput,
    value: string,
  ) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.key === key ? { ...ing, [field]: value } : ing)),
    );
  };
  const addIngredient = () =>
    setIngredients((prev) => [
      ...prev,
      { key: nextKey(), name: '', quantity: '', category: '' },
    ]);
  const removeIngredient = (key: string) =>
    setIngredients((prev) => {
      const filtered = prev.filter((ing) => ing.key !== key);
      return filtered.length > 0
        ? filtered
        : [{ key: nextKey(), name: '', quantity: '', category: '' }];
    });

  // --- Import / paste ------------------------------------------------------
  const applyImport = () => {
    const parsed = parseRecipeText(importText);
    if (parsed.name) setName(parsed.name);
    if (parsed.summary) setSummary(parsed.summary);
    if (parsed.steps.length > 0) setSteps(parsed.steps);
    if (parsed.ingredients.length > 0) {
      setIngredients(
        parsed.ingredients.map((ing) => ({
          key: nextKey(),
          name: ing.name,
          quantity: ing.quantity ?? '',
          category: '',
        })),
      );
    }
    setShowImport(false);
    setImportText('');
  };

  // Import directly from a recipe URL: the backend fetches + parses the page.
  const handleImportUrl = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    setImportError('');
    try {
      const imported = await recipeApi.importFromUrl(url);
      if (imported.name) setName(imported.name);
      if (imported.summary) setSummary(imported.summary);
      if (imported.steps.length > 0) setSteps(imported.steps);
      if (imported.ingredients.length > 0) {
        setIngredients(
          imported.ingredients.map((ing) => ({
            key: nextKey(),
            name: ing.name,
            quantity: ing.quantity ?? '',
            category: '',
          })),
        );
      }
      setSourceUrl(imported.sourceUrl || url);
      setShowImport(false);
      setImportUrl('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setImportError(
        axiosErr.response?.data?.message ||
          'Could not import from that URL. Some sites block automated imports or load their recipe with JavaScript. Copy the recipe from the page and paste it into the box below instead.',
      );
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Recipe name is required');
      return;
    }

    const payload: CreateRecipeInput = {
      name: name.trim(),
      summary: summary.trim() || undefined,
      steps: steps.map((s) => s.trim()).filter((s) => s.length > 0),
      ingredients: ingredients
        .map((ing) => ({
          name: ing.name.trim(),
          quantity: ing.quantity?.trim() || undefined,
          category: ing.category?.trim() || undefined,
        }))
        .filter((ing) => ing.name.length > 0),
      createdBy: currentUserId,
      sourceUrl,
    };

    setSubmitting(true);
    setError('');
    try {
      const saved =
        isEdit && recipe
          ? await recipeApi.update(recipe.id, payload)
          : await recipeApi.create(payload);
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 409) {
        setError('A recipe with this name already exists');
      } else {
        setError(axiosErr.response?.data?.message || 'Failed to save recipe');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-label={isEdit ? 'Edit recipe' : 'Add recipe'}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Recipe' : 'Add Recipe'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {!isEdit && (
          <div className="quick-add-section">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setShowImport((v) => !v)}
            >
              {showImport ? 'Hide import' : '🔗 Import from URL or paste a recipe'}
            </button>
            {showImport && (
              <div style={{ marginTop: '8px' }}>
                <label htmlFor="recipe-import-url">Import from a recipe URL</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    id="recipe-import-url"
                    type="url"
                    value={importUrl}
                    onChange={(e) => {
                      setImportUrl(e.target.value);
                      setImportError('');
                    }}
                    placeholder="https://example.com/best-pancakes"
                    style={{ flex: 1 }}
                    aria-label="Recipe URL to import"
                  />
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleImportUrl}
                    disabled={importing || !importUrl.trim()}
                  >
                    {importing ? 'Importing...' : 'Import'}
                  </button>
                </div>
                {importError && (
                  <p style={{ color: 'var(--color-danger, #e74c3c)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                    {importError}
                  </p>
                )}

                <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '10px 0 4px 0' }}>
                  Or paste the recipe text directly:
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={
                    'Paste a recipe here. Recognized layout:\n\nRecipe Name\nA short summary line\n\nIngredients:\n- 2 cups flour\n- 1 tsp salt\n\nSteps:\n1. Mix dry ingredients\n2. Bake'
                  }
                  rows={8}
                  style={{ width: '100%' }}
                  aria-label="Recipe text to import"
                />
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={applyImport}
                    disabled={!importText.trim()}
                  >
                    Parse into form
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="add-item-form">
          <div className="form-group">
            <label htmlFor="recipe-name">Name *</label>
            <input
              id="recipe-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fluffy Pancakes"
              maxLength={255}
            />
          </div>

          <div className="form-group">
            <label htmlFor="recipe-summary">Summary</label>
            <textarea
              id="recipe-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="A short description of the recipe"
              rows={2}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label>Ingredients</label>
            {ingredients.map((ing) => (
              <div
                key={ing.key}
                style={{
                  border: '1px solid var(--color-border, #333)',
                  borderRadius: '8px',
                  padding: '8px',
                  marginBottom: '8px',
                }}
              >
                {/* Row 1: full-width ingredient name so it is never squeezed. */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                  <input
                    type="text"
                    value={ing.name}
                    onChange={(e) => updateIngredient(ing.key, 'name', e.target.value)}
                    placeholder="Ingredient name"
                    aria-label="Ingredient name"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => removeIngredient(ing.key)}
                    aria-label="Remove ingredient"
                    style={{ padding: '6px 10px', lineHeight: 1, flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
                {/* Row 2: quantity + category. */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={ing.quantity ?? ''}
                    onChange={(e) => updateIngredient(ing.key, 'quantity', e.target.value)}
                    placeholder="Qty (e.g. 2 cups)"
                    aria-label="Ingredient quantity"
                    style={{ width: '110px', flexShrink: 0 }}
                  />
                  <select
                    value={ing.category ?? ''}
                    onChange={(e) => updateIngredient(ing.key, 'category', e.target.value)}
                    aria-label="Ingredient category"
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <option value="">No category</option>
                    {categories
                      .filter((c) => c.toLowerCase() !== 'uncategorized')
                      .map((c) => (
                        <option key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn--secondary" onClick={addIngredient}>
              + Add ingredient
            </button>
          </div>

          <div className="form-group">
            <label>Steps</label>
            {steps.map((step, index) => (
              <div
                key={index}
                style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'flex-start' }}
              >
                <span style={{ paddingTop: '8px', minWidth: '18px' }}>{index + 1}.</span>
                <textarea
                  value={step}
                  onChange={(e) => updateStep(index, e.target.value)}
                  placeholder={`Step ${index + 1}`}
                  rows={2}
                  aria-label={`Step ${index + 1}`}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => removeStep(index)}
                  aria-label="Remove step"
                  style={{ padding: '6px 10px', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn btn--secondary" onClick={addStep}>
              + Add step
            </button>
          </div>

          {error && (
            <p style={{ color: 'var(--color-danger, #e74c3c)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
              {error}
            </p>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Recipe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
