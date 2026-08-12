const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---------- helpers ----------
function rowToMeal(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    instructions: row.instructions,
    ingredients: JSON.parse(row.ingredients || '[]'),
  };
}

// Normalize an ingredient name/unit so "Tomato" and "tomato" merge together
function normKey(name, unit) {
  return `${(name || '').trim().toLowerCase()}|${(unit || '').trim().toLowerCase()}`;
}

// ---------- API: meals ----------
app.get('/api/meals', (req, res) => {
  const rows = db.prepare('SELECT * FROM meals ORDER BY category, name').all();
  res.json(rows.map(rowToMeal));
});

app.get('/api/meals/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Meal not found' });
  res.json(rowToMeal(row));
});

app.post('/api/meals', (req, res) => {
  const { name, category, description, instructions, ingredients } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const stmt = db.prepare(`
    INSERT INTO meals (name, category, description, instructions, ingredients, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  const info = stmt.run(
    name.trim(),
    (category || 'Other').trim(),
    description || '',
    instructions || '',
    JSON.stringify(ingredients || [])
  );
  const row = db.prepare('SELECT * FROM meals WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToMeal(row));
});

app.put('/api/meals/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Meal not found' });

  const { name, category, description, instructions, ingredients } = req.body;
  db.prepare(`
    UPDATE meals
    SET name = ?, category = ?, description = ?, instructions = ?, ingredients = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    (name ?? existing.name).trim(),
    (category ?? existing.category).trim(),
    description ?? existing.description,
    instructions ?? existing.instructions,
    JSON.stringify(ingredients ?? JSON.parse(existing.ingredients)),
    req.params.id
  );

  const row = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  res.json(rowToMeal(row));
});

app.delete('/api/meals/:id', (req, res) => {
  const info = db.prepare('DELETE FROM meals WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Meal not found' });
  res.status(204).end();
});

// ---------- API: shopping list ----------
app.post('/api/shopping-list', (req, res) => {
  const { mealIds } = req.body;
  if (!Array.isArray(mealIds) || mealIds.length === 0) {
    return res.status(400).json({ error: 'mealIds array is required' });
  }

  const placeholders = mealIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM meals WHERE id IN (${placeholders})`).all(...mealIds);
  const meals = rows.map(rowToMeal);

  // Combine ingredients across selected meals. Same name+unit -> quantities summed.
  // Same name, different/missing unit -> listed as separate lines.
  const combined = new Map();
  for (const meal of meals) {
    for (const ing of meal.ingredients) {
      const name = (ing.name || '').trim();
      if (!name) continue;
      const unit = (ing.unit || '').trim();
      const qty = Number(ing.quantity) || 0;
      const key = normKey(name, unit);

      if (!combined.has(key)) {
        combined.set(key, { name, unit, quantity: 0, meals: [] });
      }
      const entry = combined.get(key);
      entry.quantity += qty;
      entry.meals.push(meal.name);
    }
  }

  const shoppingList = Array.from(combined.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity > 0 ? Math.round(item.quantity * 100) / 100 : null,
      usedIn: [...new Set(item.meals)],
    }));

  res.json({ meals: meals.map((m) => ({ id: m.id, name: m.name })), shoppingList });
});

// ---------- serve React build ----------
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback for any non-API route (Express 5 / path-to-regexp v6 safe form)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Meal planner server running on port ${PORT}`);
});
