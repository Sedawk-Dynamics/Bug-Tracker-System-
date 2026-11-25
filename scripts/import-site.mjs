// Copies the public items of an old tracker site into a new data folder. Never overwrites existing files.
// Accounts, passwords, access requests and deleted items are not public, so they are not copied.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [site, folder] = process.argv.slice(2);
if (!site || !folder) throw new Error('Usage: node scripts/import-site.mjs https://old-site.example /data');
const url = new URL('/api/items', site);
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Use the https:// address of the old site.');
const target = join(folder, 'live.db'), seedTarget = join(folder, 'findings.json');
for (const file of [target, seedTarget]) if (existsSync(file)) throw new Error('Refusing to overwrite ' + file);

const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`The old site answered ${response.status}. Check the address, and that it opens without signing in.`);
let items;
try { items = await response.json(); } catch { throw new Error('The old site did not return item data. Check the address.'); }
const kinds = ['problems', 'flows', 'untested', 'deliverables'], statuses = ['Open', 'In progress', 'Done'];
if (!Array.isArray(items) || !items.length) throw new Error('The old site returned no items.');
for (const i of items)
  if (typeof i?.id !== 'string' || typeof i.title !== 'string' || typeof i.area !== 'string' || !kinds.includes(i.kind) || !statuses.includes(i.status) || !Number.isInteger(i.version))
    throw new Error('Unexpected item: ' + String(i?.id));
if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('The old site returned duplicate IDs.');

const runtime = ['status', 'owner', 'notes', 'version', 'updatedAt', 'updatedBy'];
const fields = ['title', 'area', 'severity', 'problem', 'why', 'fix', 'expected', 'current', 'how', 'advantages', 'what', 'reason', 'needed', 'owner', 'notes', 'status'];
const payload = item => JSON.stringify(Object.fromEntries(fields.filter(key => typeof item[key] === 'string').map(key => [key, item[key]])));
const added = items.filter(i => i.id.startsWith('NEW-')), originals = items.filter(i => !i.id.startsWith('NEW-'));
const edited = originals.filter(i => i.version > 0);

mkdirSync(folder, { recursive: true });
// Built under temporary names and renamed at the end, so an interrupted import never looks finished.
const tempDb = target + '.importing', tempSeed = seedTarget + '.importing';
for (const temp of [tempDb, tempDb + '-journal', tempSeed]) rmSync(temp, { force: true });
const db = new DatabaseSync(tempDb);
try {
  for (const name of ['updates', 'auth', 'requests', 'items', 'deletions']) db.exec(readFileSync(join('db', `${name}-schema.sql`), 'utf8'));
  db.exec('BEGIN');
  const custom = db.prepare('INSERT INTO custom_items (id,kind,payload,version,updated_at,updated_by) VALUES (?,?,?,?,?,?)');
  for (const i of added) custom.run(i.id, i.kind, payload(i), i.version, i.updatedAt || '', i.updatedBy || '');
  const update = db.prepare('INSERT INTO updates (id,payload,version,updated_at,updated_by) VALUES (?,?,?,?,?)');
  for (const i of edited) update.run(i.id, payload(i), i.version, i.updatedAt || '', i.updatedBy || '');
  db.exec('COMMIT');
  const seed = originals.map(i => Object.fromEntries(Object.entries(i).filter(([key]) => !runtime.includes(key))));
  writeFileSync(tempSeed, JSON.stringify(seed, null, 2), { flag: 'wx', mode: 0o600 });
  db.close();
  renameSync(tempSeed, seedTarget);
  renameSync(tempDb, target);
  console.log(`Original items: ${originals.length} (${edited.length} edited)\nAdded items: ${added.length}\nTotal copied: ${items.length}`);
  console.log(statuses.map(s => `${s}: ${items.filter(i => i.status === s).length}`).join('\n'));
} catch (error) {
  if (db.isOpen) db.close();
  for (const temp of [tempDb, tempSeed]) rmSync(temp, { force: true });
  throw error;
}
