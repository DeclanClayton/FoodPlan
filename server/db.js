const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// DB_PATH lets you point this at a Render persistent disk mount (e.g. /data/meals.db)
// so data survives deploys/restarts. Defaults to a local file for dev.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'meals.db');

// Make sure the directory exists (important if DB_PATH points into a mounted disk)
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Other',
    description TEXT DEFAULT '',
    instructions TEXT DEFAULT '',
    ingredients TEXT NOT NULL DEFAULT '[]',
    sunday_prep TEXT DEFAULT '',
    midweek_prep TEXT DEFAULT '',
    freezable INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Lightweight migration: add any of the above columns that don't exist yet on a database
// created before this version of the app (so existing deployments upgrade in place).
const existingCols = new Set(db.prepare('PRAGMA table_info(meals)').all().map((c) => c.name));
const wantedCols = {
  sunday_prep: "TEXT DEFAULT ''",
  midweek_prep: "TEXT DEFAULT ''",
  freezable: 'INTEGER NOT NULL DEFAULT 0',
};
for (const [col, def] of Object.entries(wantedCols)) {
  if (!existingCols.has(col)) {
    db.exec(`ALTER TABLE meals ADD COLUMN ${col} ${def};`);
  }
}

// Singleton row holding whatever week is currently being planned. Submitting fresh
// selections always overwrites this — there's no history, just "the current plan."
db.exec(`
  CREATE TABLE IF NOT EXISTS weekly_plan (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT NOT NULL DEFAULT 'none',
    selections TEXT NOT NULL DEFAULT '[]',
    assignments TEXT NOT NULL DEFAULT '{}',
    submitted_at TEXT,
    published_at TEXT
  );
`);
db.prepare(
  `INSERT OR IGNORE INTO weekly_plan (id, status, selections, assignments) VALUES (1, 'none', '[]', '{}')`
).run();

module.exports = db;
