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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

module.exports = db;
