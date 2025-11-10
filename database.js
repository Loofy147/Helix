const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function openDb() {
  return open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });
}

async function setup() {
  const db = await openDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS vectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vector TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      number INTEGER NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL,
      phase_name TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT,
      FOREIGN KEY (cycle_id) REFERENCES cycles(id)
    );
  `);
  console.log('Database schema initialized.');
}

module.exports = { openDb, setup };
