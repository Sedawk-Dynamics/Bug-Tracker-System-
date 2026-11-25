import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Same small API the routes already use on Cloudflare D1, backed by a SQLite file.
class Statement {
  constructor(private db: DatabaseSync, private sql: string, private args: SQLInputValue[] = []) {}
  bind(...args: SQLInputValue[]) { return new Statement(this.db, this.sql, args); }
  async first<T = Record<string, unknown>>() { return (this.db.prepare(this.sql).get(...this.args) ?? null) as T | null; }
  async all<T = Record<string, unknown>>() { return { results: this.db.prepare(this.sql).all(...this.args) as T[] }; }
  async run() { return this.runSync(); }
  runSync() { this.db.prepare(this.sql).run(...this.args); return { success: true }; }
}

class Database {
  constructor(private db: DatabaseSync) {}
  prepare(sql: string) { return new Statement(this.db, sql); }
  async batch(statements: Statement[]) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const out = statements.map(s => s.runSync()); this.db.exec('COMMIT'); return out; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}

let database: Database | undefined;
function open() {
  const file = process.env.DATABASE_PATH || './storage/tracker.db';
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  for (const name of ['updates', 'auth', 'requests', 'items', 'deletions'])
    db.exec(readFileSync(join(process.cwd(), 'db', `${name}-schema.sql`), 'utf8'));
  return new Database(db);
}

export const env = {
  get DB() { return (database ??= open()); },
  get OWNER_EMAIL() { return process.env.OWNER_EMAIL; },
};
