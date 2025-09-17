import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import logger from '../../lib/logger';

let instance: Database.Database | null = null;

const DEFAULT_DB_FILE = path.resolve(process.cwd(), 'app.db');

function ensureDirectory(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function migrate(db: Database.Database): void {
  const createSql = `
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      priority INTEGER DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_todos_title ON todos(title);
    CREATE INDEX IF NOT EXISTS idx_todos_done ON todos(done);
  `;

  db.exec(createSql);
  logger.info('SQLite migrations applied');
}

export function getDb(): Database.Database {
  if (instance) return instance;

  const dbPath = process.env.SQLITE_DB_PATH
    ? path.resolve(process.cwd(), process.env.SQLITE_DB_PATH)
    : DEFAULT_DB_FILE;

  ensureDirectory(dbPath);

  instance = new Database(dbPath);
  instance.pragma('journal_mode = WAL');

  migrate(instance);
  logger.info('SQLite database initialized', { dbPath });
  return instance;
}

export default getDb;
