import { useEffect, useState } from 'react';
import { api } from '../api.js';

const emptyIngredient = () => ({ name: '', quantity: '', unit: '', calories: '', protein: '', fat: '' });
const emptyForm = () => ({
  name: '',
  category: '',
  description: '',
  instructions: '',
  ingredients: [emptyIngredient()],
});

// Parses text pasted from a spreadsheet or a Word table into ingredient rows.
// Handles two shapes:
//  1. A header row naming its columns (in any order) — recognizes Name/Ingredient,
//     Quantity/Qty, Unit, Calories/Kcal, Protein, Fat. This is the shape you get
//     copying a Word table like: [Dish Name] | Kcal | Protein | Fat, with the dish
//     name sitting in the top-left cell — that cell is pulled out as the meal name.
//  2. No recognizable header — assumed to be Name, Quantity, Unit, Calories in that
//     order (the plain spreadsheet case).
// Tab-separated (how browsers paste table cells) or comma-separated both work.
function detectHeaderColumns(headerRow) {
  const map = {};
  headerRow.forEach((cell, idx) => {
    const c = cell.toLowerCase();
    if (/^(name|ingredient|ingredients)$/.test(c)) map.name = idx;
    else if (/^(qty|quantity|amount)$/.test(c)) map.quantity = idx;
    else if (/^unit(s)?$/.test(c)) map.unit = idx;
    else if (/kcal|calorie/.test(c)) map.calories = idx;
    else if (/protein/.test(c)) map.protein = idx;
    else if (/\bfat\b/.test(c)) map.fat = idx;
  });
  return map;
}

// Pulls a leading quantity + unit off an ingredient string like "200g Chicken breast"
// or "1/2 cup Rice", leaving just the ingredient name. Falls back to no quantity/unit
// if nothing matches.
function splitQuantityFromName(raw) {
  const text = (raw || '').trim();
  const unitPattern =
    'g|kg|mg|ml|l|tsp|tbsp|tbs|cup|cups|oz|lb|lbs|clove|cloves|slice|slices|piece|pieces|pinch|can|cans|tin|tins|bunch|stick|sticks|handful';
  const match = text.match(new RegExp(`^([\\d.]+(?:\\/[\\d.]+)?)\\s*(${unitPattern})?\\s+(.+)$`, 'i'));
  if (match) {
    return { quantity: match[1], unit: match[2] || '', name: match[3] };
  }
  return { quantity: '', unit: '', name: text };
}

function parsePastedIngredients(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { mealName: null, ingredients: [] };

  const rows = lines.map((line) => {
    const delim = line.includes('\t') ? '\t' : ',';
    return line.split(delim).map((cell) => cell.trim());
  });

  const header = rows[0];
  const map = detectHeaderColumns(header);
  const hasHeader =
    map.calories !== undefined ||
    map.protein !== undefined ||
    map.fat !== undefined ||
    map.quantity !== undefined ||
    map.unit !== undefined ||
    map.name !== undefined;

  let dataRows = rows;
  let mealName = null;

  if (hasHeader) {
    dataRows = rows.slice(1);
    if (map.name === undefined) {
      map.name = 0; // first column is always the ingredient name
      const label = header[0];
      // top-left cell wasn't a generic label like "Ingredients" — it's the dish name
      if (label && !/^(name|ingredient|ingredients)$/i.test(label)) {
        mealName = label;
      }
    }
  } else {
    map.name = 0;
    map.quantity = 1;
    map.unit = 2;
    map.calories = 3;
  }

  const noSeparateQtyUnit = map.quantity === undefined && map.unit === undefined;

  const ingredients = dataRows
    .filter((cols) => cols[map.name])
    .map((cols) => {
      const rawName = cols[map.name] || '';
      const base = noSeparateQtyUnit
        ? splitQuantityFromName(rawName)
        : { quantity: map.quantity !== undefined ? cols[map.quantity] || '' : '', unit: map.unit !== undefined ? cols[map.unit] || '' : '', name: rawName };
      return {
        name: base.name,
        quantity: base.quantity,
        unit: base.unit,
        calories: map.calories !== undefined ? cols[map.calories] || '' : '',
        protein: map.protein !== undefined ? cols[map.protein] || '' : '',
        fat: map.fat !== undefined ? cols[map.fat] || '' : '',
      };
    });

  return { mealName, ingredients };
}

export default function Admin() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creating new
  const [form, setForm] = useState(emptyForm());
  const [pasteText, setPasteText] = useState('');
  const [pasteMsg, setPasteMsg] = useState('');

  function loadMeals() {
    setLoading(true);
    api
      .getMeals()
      .then(setMeals)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadMeals, []);

  function startEdit(meal) {
    setEditingId(meal.id);
    setForm({
      name: meal.name,
      category: meal.category,
      description: meal.description,
      instructions: meal.instructions,
      ingredients: meal.ingredients.length ? meal.ingredients : [emptyIngredient()],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleDelete(id) {
    if (!confirm('Delete this meal? This cannot be undone.')) return;
    try {
      await api.deleteMeal(id);
      setMeals((prev) => prev.filter((m) => m.id !== id));
      if (editingId === id) startNew();
    } catch (e) {
      setError(e.message);
    }
  }

  function updateIngredient(index, field, value) {
    setForm((prev) => {
      const ingredients = [...prev.ingredients];
      ingredients[index] = { ...ingredients[index], [field]: value };
      return { ...prev, ingredients };
    });
  }

  function addIngredientRow() {
    setForm((prev) => ({ ...prev, ingredients: [...prev.ingredients, emptyIngredient()] }));
  }

  function removeIngredientRow(index) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }

  function handlePasteImport() {
    const { mealName, ingredients: parsed } = parsePastedIngredients(pasteText);
    if (parsed.length === 0) {
      setPasteMsg("Couldn't find any rows — check the format below.");
      return;
    }
    setForm((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : mealName || prev.name,
      // drop any still-empty manual rows, keep anything already filled in, add the pasted rows
      ingredients: [...prev.ingredients.filter((i) => i.name.trim()), ...parsed],
    }));
    setPasteText('');
    setPasteMsg(
      `Added ${parsed.length} ingredient${parsed.length === 1 ? '' : 's'}` +
        (mealName ? ` and set the meal name to "${mealName}".` : '.')
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Meal name is required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      category: form.category.trim() || 'Other',
      ingredients: form.ingredients
        .filter((ing) => ing.name.trim())
        .map((ing) => ({
          name: ing.name.trim(),
          quantity: ing.quantity === '' ? null : Number(ing.quantity),
          unit: ing.unit.trim(),
          calories: ing.calories === '' ? null : Number(ing.calories),
          protein: ing.protein === '' ? null : Number(ing.protein),
          fat: ing.fat === '' ? null : Number(ing.fat),
        })),
    };

    try {
      if (editingId) {
        const updated = await api.updateMeal(editingId, payload);
        setMeals((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
      } else {
        const created = await api.createMeal(payload);
        setMeals((prev) => [...prev, created]);
      }
      startNew();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="hero hero--compact">
        <p className="eyebrow">Admin</p>
        <h1>Manage Meals</h1>
      </header>

      {error && <p className="error center">{error}</p>}

      <form className="admin-form" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Edit meal' : 'Add a meal'}</h2>

        <label className="field">
          <span>Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Chicken Tikka Masala"
            required
          />
        </label>

        <label className="field">
          <span>Category</span>
          <input
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            placeholder="e.g. Dinner, Breakfast, Sides"
          />
        </label>

        <label className="field">
          <span>Short description</span>
          <input
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="One line shown in the meal list"
          />
        </label>

        <div className="field">
          <span>Paste from a spreadsheet</span>
          <textarea
            className="paste-box"
            rows={4}
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setPasteMsg('');
            }}
            placeholder={
              'Paste a table from Word, Excel, or Google Sheets.\n\n' +
              'From a Word table like: [Dish Name] | Kcal | Protein | Fat\n' +
              '— top-left cell becomes the meal name, and if the ingredients\n' +
              'cell has the amount in it too (e.g. "200g Chicken breast"),\n' +
              'that gets split into quantity/unit/name automatically.\n\n' +
              'Or from a plain list, columns in order: Name, Quantity, Unit, Calories\n' +
              'e.g.\nChicken breast\t400\tg\t660'
            }
          />
          <div className="paste-actions">
            <button type="button" className="link-btn" onClick={handlePasteImport}>
              Add pasted rows to ingredients
            </button>
            {pasteMsg && <span className="paste-msg">{pasteMsg}</span>}
          </div>
        </div>

        <div className="field">
          <span>Ingredients</span>
          <div className="ingredient-rows">
            {form.ingredients.map((ing, i) => (
              <div className="ingredient-card" key={i}>
                <div className="ingredient-card-top">
                  <input
                    className="ing-name"
                    value={ing.name}
                    onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                    placeholder="Ingredient name"
                  />
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeIngredientRow(i)}
                    aria-label="Remove ingredient"
                  >
                    ×
                  </button>
                </div>
                <div className="ingredient-card-grid">
                  <label>
                    <span>Qty</span>
                    <input
                      value={ing.quantity}
                      onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
                      inputMode="decimal"
                    />
                  </label>
                  <label>
                    <span>Unit</span>
                    <input
                      value={ing.unit}
                      onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Kcal</span>
                    <input
                      value={ing.calories}
                      onChange={(e) => updateIngredient(i, 'calories', e.target.value)}
                      inputMode="numeric"
                    />
                  </label>
                  <label>
                    <span>Protein g</span>
                    <input
                      value={ing.protein}
                      onChange={(e) => updateIngredient(i, 'protein', e.target.value)}
                      inputMode="decimal"
                    />
                  </label>
                  <label>
                    <span>Fat g</span>
                    <input
                      value={ing.fat}
                      onChange={(e) => updateIngredient(i, 'fat', e.target.value)}
                      inputMode="decimal"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="link-btn" onClick={addIngredientRow}>
            + Add ingredient
          </button>
        </div>

        <label className="field">
          <span>Recipe / instructions</span>
          <textarea
            rows={5}
            value={form.instructions}
            onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
            placeholder="Steps to cook this meal"
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add meal'}
          </button>
          {editingId && (
            <button type="button" className="secondary-btn" onClick={startNew}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="admin-list">
        <h2>All meals</h2>
        {loading && <p className="muted center">Loading…</p>}
        {!loading && meals.length === 0 && <p className="muted center">No meals yet.</p>}
        <ul className="meal-list">
          {meals.map((meal) => (
            <li key={meal.id} className="meal-card">
              <div className="admin-meal-row">
                <span className="meal-info">
                  <span className="meal-name">{meal.name}</span>
                  <span className="meal-desc">{meal.category}</span>
                </span>
                <div className="admin-meal-actions">
                  <button type="button" className="link-btn" onClick={() => startEdit(meal)}>
                    Edit
                  </button>
                  <button type="button" className="link-btn danger" onClick={() => handleDelete(meal.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
