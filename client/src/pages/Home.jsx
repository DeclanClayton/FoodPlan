import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

export default function Home() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [list, setList] = useState(null); // shopping list result
  const [listLoading, setListLoading] = useState(false);
  const [checkedOff, setCheckedOff] = useState(() => new Set());

  useEffect(() => {
    api
      .getMeals()
      .then(setMeals)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function mealMacros(meal) {
    const totals = meal.ingredients.reduce(
      (acc, ing) => ({
        calories: acc.calories + (Number(ing.calories) || 0),
        protein: acc.protein + (Number(ing.protein) || 0),
        fat: acc.fat + (Number(ing.fat) || 0),
      }),
      { calories: 0, protein: 0, fat: 0 }
    );
    return totals.calories > 0 || totals.protein > 0 || totals.fat > 0 ? totals : null;
  }

  const selectedMacros = useMemo(() => {
    return meals
      .filter((m) => selected.has(m.id))
      .reduce(
        (acc, m) => {
          const macros = mealMacros(m);
          if (!macros) return acc;
          return {
            calories: acc.calories + macros.calories,
            protein: acc.protein + macros.protein,
            fat: acc.fat + macros.fat,
          };
        },
        { calories: 0, protein: 0, fat: 0 }
      );
  }, [meals, selected]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const meal of meals) {
      const cat = meal.category || 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(meal);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [meals]);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function buildList() {
    if (selected.size === 0) return;
    setListLoading(true);
    setError('');
    try {
      const result = await api.getShoppingList(Array.from(selected));
      setList(result);
      setCheckedOff(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setListLoading(false);
    }
  }

  function toggleChecked(key) {
    setCheckedOff((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  if (list) {
    return (
      <ShoppingList
        list={list}
        checkedOff={checkedOff}
        onToggle={toggleChecked}
        onBack={() => setList(null)}
      />
    );
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Pick your meals</p>
        <h1>Pantry &amp; Plan</h1>
      </header>

      {loading && <p className="muted center">Loading meals…</p>}
      {error && <p className="error center">{error}</p>}
      {!loading && meals.length === 0 && !error && (
        <p className="muted center">
          No meals yet. Ask whoever manages the plan to add some.
        </p>
      )}

      <div className="meal-groups">
        {grouped.map(([category, items]) => (
          <section key={category} className="group">
            <h2 className="group-title">{category}</h2>
            <ul className="meal-list">
              {items.map((meal) => {
                const isSelected = selected.has(meal.id);
                const isExpanded = expanded.has(meal.id);
                return (
                  <li key={meal.id} className={`meal-card ${isSelected ? 'is-selected' : ''}`}>
                    <button
                      type="button"
                      className="meal-row"
                      onClick={() => toggleSelect(meal.id)}
                    >
                      <span className={`checkbox ${isSelected ? 'checked' : ''}`} aria-hidden="true">
                        {isSelected && '✓'}
                      </span>
                      <span className="meal-info">
                        <span className="meal-name-row">
                          <span className="meal-name">{meal.name}</span>
                          {mealMacros(meal) && (
                            <span className="meal-cals">
                              {Math.round(mealMacros(meal).calories)} kcal
                            </span>
                          )}
                        </span>
                        {meal.description && (
                          <span className="meal-desc">{meal.description}</span>
                        )}
                      </span>
                    </button>
                    {(meal.instructions || meal.ingredients.length > 0) && (
                      <button
                        type="button"
                        className="expand-toggle"
                        onClick={() => toggleExpand(meal.id)}
                      >
                        {isExpanded ? 'Hide recipe' : 'View recipe'}
                      </button>
                    )}
                    {isExpanded && (
                      <div className="recipe-detail">
                        {meal.ingredients.length > 0 && (
                          <>
                            <h3>Ingredients</h3>
                            <ul className="ingredient-list">
                              {meal.ingredients.map((ing, i) => (
                                <li key={i}>
                                  {ing.quantity ? `${ing.quantity} ` : ''}
                                  {ing.unit ? `${ing.unit} ` : ''}
                                  {ing.name}
                                  {(ing.calories || ing.protein || ing.fat) && (
                                    <span className="ing-macros">
                                      {' — '}
                                      {ing.calories ? `${ing.calories} kcal` : ''}
                                      {ing.protein ? `${ing.calories ? ', ' : ''}${ing.protein}g protein` : ''}
                                      {ing.fat ? `${ing.calories || ing.protein ? ', ' : ''}${ing.fat}g fat` : ''}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                        {meal.instructions && (
                          <>
                            <h3>Recipe</h3>
                            <p className="instructions">{meal.instructions}</p>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="sticky-bar">
          {selectedMacros.calories > 0 && (
            <p className="selected-cals">
              {Math.round(selectedMacros.calories)} kcal
              {selectedMacros.protein > 0 ? ` · ${Math.round(selectedMacros.protein)}g protein` : ''}
              {selectedMacros.fat > 0 ? ` · ${Math.round(selectedMacros.fat)}g fat` : ''}
              {' '}for selected meals
            </p>
          )}
          <button type="button" className="primary-btn" onClick={buildList} disabled={listLoading}>
            {listLoading
              ? 'Building…'
              : `Build shopping list (${selected.size} meal${selected.size === 1 ? '' : 's'})`}
          </button>
        </div>
      )}
    </div>
  );
}

function ShoppingList({ list, checkedOff, onToggle, onBack }) {
  return (
    <div className="page">
      <header className="hero hero--compact">
        <button type="button" className="back-btn" onClick={onBack}>
          ‹ Back to meals
        </button>
        <p className="eyebrow">Shopping list</p>
        <h1>The Ticket</h1>
        <p className="muted">
          For {list.meals.map((m) => m.name).join(', ')}
        </p>
      </header>

      <div className="receipt">
        <ul className="receipt-list">
          {list.shoppingList.map((item) => {
            const key = `${item.name}|${item.unit}`;
            const done = checkedOff.has(key);
            return (
              <li key={key} className={done ? 'is-done' : ''}>
                <button type="button" className="receipt-row" onClick={() => onToggle(key)}>
                  <span className={`checkbox ${done ? 'checked' : ''}`} aria-hidden="true">
                    {done && '✓'}
                  </span>
                  <span className="receipt-name">{item.name}</span>
                  <span className="receipt-qty">
                    {item.quantity ? `${item.quantity} ` : ''}
                    {item.unit || ''}
                  </span>
                </button>
                <span className="receipt-used">used in {item.usedIn.join(', ')}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
