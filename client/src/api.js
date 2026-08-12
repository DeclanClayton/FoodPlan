const BASE = '/api';

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getMeals: () => fetch(`${BASE}/meals`).then(handle),
  getMeal: (id) => fetch(`${BASE}/meals/${id}`).then(handle),
  createMeal: (meal) =>
    fetch(`${BASE}/meals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meal),
    }).then(handle),
  updateMeal: (id, meal) =>
    fetch(`${BASE}/meals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meal),
    }).then(handle),
  deleteMeal: (id) => fetch(`${BASE}/meals/${id}`, { method: 'DELETE' }).then(handle),
  getShoppingList: (mealIds) =>
    fetch(`${BASE}/shopping-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealIds }),
    }).then(handle),
};
