import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function Home() {
  const [meals, setMeals] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [planningNext, setPlanningNext] = useState(false);

  const [list, setList] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [checkedOff, setCheckedOff] = useState(() => new Set());

  function loadAll() {
    setLoading(true);
    setError('');
    Promise.all([api.getMeals(), api.getWeeklyPlan()])
      .then(([mealsData, planData]) => {
        setMeals(mealsData);
        setPlan(planData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);

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

  function startPicking(prefillFromPlan) {
    if (prefillFromPlan && plan?.selections?.length) {
      setSelected(new Set(plan.selections.map((m) => m.id)));
    } else {
      setSelected(new Set());
    }
    setPlanningNext(true);
  }

  async function handleSubmitWeek() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const updated = await api.submitWeeklyPlan(Array.from(selected));
      setPlan(updated);
      setPlanningNext(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function buildListFor(mealIds) {
    if (!mealIds.length) return;
    setListLoading(true);
    setError('');
    try {
      const result = await api.getShoppingList(mealIds);
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

  if (loading) {
    return (
      <div className="page">
        <p className="muted center">Loading…</p>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="page">
        <p className="error center">{error}</p>
      </div>
    );
  }

  const showPicker = planningNext || plan?.status === 'none';

  if (showPicker) {
    return (
      <MealPicker
        grouped={grouped}
        meals={meals}
        selected={selected}
        toggleSelect={toggleSelect}
        expanded={expanded}
        toggleExpand={toggleExpand}
        mealMacros={mealMacros}
        selectedMacros={selectedMacros}
        onSubmit={handleSubmitWeek}
        submitting={submitting}
        error={error}
        onCancel={plan && plan.status !== 'none' ? () => setPlanningNext(false) : null}
      />
    );
  }

  if (plan.status === 'submitted') {
    return (
      <div className="page">
        <header className="hero">
          <p className="eyebrow">Submitted</p>
          <h1>Thanks!</h1>
        </header>
        <p className="muted center">
          Your picks are in — hang tight while the week gets sorted into a plan. Check back soon.
        </p>
        {error && <p className="error center">{error}</p>}
        <div className="plan-selections">
          {plan.selections.map((meal) => (
            <div key={meal.id} className="plan-selection-chip">
              <span>{meal.name}</span>
            </div>
          ))}
        </div>
        <button type="button" className="secondary-btn edit-picks-btn" onClick={() => startPicking(true)}>
          Edit my picks
        </button>
      </div>
    );
  }

  // plan.status === 'published'
  const assignedIds = DAYS.map((d) => plan.assignments[d]?.id).filter(Boolean);

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">This week</p>
        <h1>Pantry &amp; Plan</h1>
      </header>

      {error && <p className="error center">{error}</p>}

      <div className="calendar">
        {DAYS.map((day) => {
          const meal = plan.assignments[day];
          const isExpanded = meal && expanded.has(meal.id);
          return (
            <div key={day} className="day-card">
              <div className="day-card-header">
                <span className="day-label">{day}</span>
                {meal?.freezable && <span className="freezable-badge">❄ freezable</span>}
              </div>
              {meal ? (
                <>
                  <p className="day-meal-name">{meal.name}</p>
                  <button type="button" className="expand-toggle" onClick={() => toggleExpand(meal.id)}>
                    {isExpanded ? 'Hide recipe' : 'View recipe'}
                  </button>
                  {isExpanded && (
                    <div className="recipe-detail">
                      {meal.ingredients?.length > 0 && (
                        <>
                          <h3>Ingredients</h3>
                          <ul className="ingredient-list">
                            {meal.ingredients.map((ing, i) => (
                              <li key={i}>
                                {ing.quantity ? `${ing.quantity} ` : ''}
                                {ing.unit ? `${ing.unit} ` : ''}
                                {ing.name}
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
                      {meal.sundayPrep && <p className="prep-hint">Sunday prep: {meal.sundayPrep}</p>}
                      {meal.midweekPrep && <p className="prep-hint">Midweek prep: {meal.midweekPrep}</p>}
                    </div>
                  )}
                </>
              ) : (
                <p className="muted">Not assigned yet</p>
              )}
            </div>
          );
        })}
        <div className="day-card day-card--cheat">
          <div className="day-card-header">
            <span className="day-label">Saturday</span>
          </div>
          <p className="muted">🎉 Cheat day — no plan needed</p>
        </div>
      </div>

      <div className="sticky-bar">
        {assignedIds.length > 0 && (
          <button
            type="button"
            className="primary-btn"
            onClick={() => buildListFor(assignedIds)}
            disabled={listLoading}
          >
            {listLoading ? 'Building…' : 'Build shopping list for this week'}
          </button>
        )}
        <button type="button" className="secondary-btn plan-next-btn" onClick={() => startPicking(false)}>
          Plan next week
        </button>
      </div>
    </div>
  );
}

function MealPicker({
  grouped,
  meals,
  selected,
  toggleSelect,
  expanded,
  toggleExpand,
  mealMacros,
  selectedMacros,
  onSubmit,
  submitting,
  error,
  onCancel,
}) {
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Pick your meals for next week</p>
        <h1>Pantry &amp; Plan</h1>
        <p className="muted">Saturday's your cheat day — no need to plan for it.</p>
      </header>

      {error && <p className="error center">{error}</p>}
      {meals.length === 0 && (
        <p className="muted center">No meals yet. Ask whoever manages the plan to add some.</p>
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
                    <button type="button" className="meal-row" onClick={() => toggleSelect(meal.id)}>
                      <span className={`checkbox ${isSelected ? 'checked' : ''}`} aria-hidden="true">
                        {isSelected && '✓'}
                      </span>
                      <span className="meal-info">
                        <span className="meal-name-row">
                          <span className="meal-name">{meal.name}</span>
                          {mealMacros(meal) && (
                            <span className="meal-cals">{Math.round(mealMacros(meal).calories)} kcal</span>
                          )}
                          {meal.freezable && <span className="freezable-badge">❄</span>}
                        </span>
                        {meal.description && <span className="meal-desc">{meal.description}</span>}
                      </span>
                    </button>
                    {(meal.instructions || meal.ingredients.length > 0) && (
                      <button type="button" className="expand-toggle" onClick={() => toggleExpand(meal.id)}>
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
                        {meal.sundayPrep && <p className="prep-hint">Sunday prep: {meal.sundayPrep}</p>}
                        {meal.midweekPrep && <p className="prep-hint">Midweek prep: {meal.midweekPrep}</p>}
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
          <button type="button" className="primary-btn" onClick={onSubmit} disabled={submitting}>
            {submitting
              ? 'Submitting…'
              : `Submit for the week (${selected.size} meal${selected.size === 1 ? '' : 's'})`}
          </button>
          {onCancel && (
            <button type="button" className="secondary-btn cancel-picking-btn" onClick={onCancel}>
              Cancel
            </button>
          )}
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
          ‹ Back
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
