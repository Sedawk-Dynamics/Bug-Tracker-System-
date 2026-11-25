// Moves a Cloudflare D1 export and its findings.json into a data folder. Never overwrites existing files.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [source, findings, folder] = process.argv.slice(2);
if (!source || !findings || !folder) throw new Error('Usage: node scripts/import-d1.mjs export.sql findings.json /data');
const target = join(folder, 'live.db'), seedTarget = join(folder, 'findings.json');
for (const file of [target, seedTarget]) if (existsSync(file)) throw new Error('Refusing to overwrite ' + file);

const seed = JSON.parse(readFileSync(findings, 'utf8').replace(/^﻿/, ''));
const kinds = ['problems', 'flows', 'untested', 'deliverables'];
if (!Array.isArray(seed) || !seed.every(i => typeof i.id === 'string' && typeof i.title === 'string' && typeof i.area === 'string' && kinds.includes(i.kind)))
  throw new Error('findings.json has an invalid item.');
const ids = new Set(seed.map(i => i.id));
if (ids.size !== seed.length) throw new Error('findings.json has duplicate IDs.');

mkdirSync(folder, { recursive: true });
const db = new DatabaseSync(target, { enableForeignKeyConstraints: false });
try {
  db.exec('BEGIN');
  db.exec(readFileSync(source, 'utf8').replace(/^﻿/, ''));
  db.exec('COMMIT');
  if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('The export has broken references.');
  const custom = new Set(db.prepare('SELECT id FROM custom_items').all().map(r => r.id));
  const needed = [...db.prepare('SELECT id FROM updates').all(), ...db.prepare('SELECT id FROM deleted_items').all()].map(r => r.id);
  const missing = [...new Set(needed)].filter(id => !ids.has(id) && !custom.has(id));
  if (missing.length && !process.argv.includes('--allow-missing'))
    throw new Error(`findings.json is missing ${missing.length} original item(s): ${missing.join(', ')}. Their data would be hidden. Use the old site's own findings.json.`);
  db.exec('DELETE FROM auth_sessions; DELETE FROM auth_limits');
  const count = table => db.prepare(`SELECT count(*) n FROM ${table}`).get().n;
  const removed = new Set(db.prepare('SELECT id FROM deleted_items').all().map(r => r.id));
  const summary = `Original items: ${seed.length}\nAdded items: ${custom.size}\nDeleted items: ${removed.size}\nAccounts: ${count('auth_users')}\nAccess requests: ${count('access_requests')}\nItems that should be visible: ${[...ids, ...custom].filter(id => !removed.has(id)).length}`;
  writeFileSync(seedTarget, JSON.stringify(seed, null, 2), { flag: 'wx', mode: 0o600 });
  db.close();
  console.log(summary);
} catch (error) {
  db.close();
  rmSync(target, { force: true });
  throw error;
}
