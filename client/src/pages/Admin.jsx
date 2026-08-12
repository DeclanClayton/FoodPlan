import { useEffect, useState } from 'react';
import { api } from '../api.js';

const emptyIngredient = () => ({ name: '', quantity: '', unit: '' });
const emptyForm = () => ({
  name: '',
  category: '',
  description: '',
  instructions: '',
  ingredients: [emptyIngredient()],
});

export default function Admin() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creating new
  const [form, setForm] = useState(emptyForm());

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
          <span>Ingredients</span>
          <div className="ingredient-rows">
            {form.ingredients.map((ing, i) => (
              <div className="ingredient-row" key={i}>
                <input
                  className="ing-qty"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
                  placeholder="Qty"
                  inputMode="decimal"
                />
                <input
                  className="ing-unit"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                  placeholder="Unit"
                />
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
