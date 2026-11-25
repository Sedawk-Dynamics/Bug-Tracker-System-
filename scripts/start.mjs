// Container entry point: optional one-time setup controlled by environment variables, then the server.
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const { DATABASE_PATH: file = './storage/tracker.db', SEED_PATH, IMPORT_FROM, OWNER_EMAIL, CREATE_OWNER_LINK } = process.env;
function script(name, ...args) {
  const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', join('scripts', name), ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(name + ' failed; see the message above.');
}

// Stop on failure: starting without the data would create an empty database and hide the problem.
if (IMPORT_FROM && !existsSync(file)) {
  if (basename(file) !== 'live.db' || SEED_PATH !== join(dirname(file), 'findings.json'))
    throw new Error('To use IMPORT_FROM, set DATABASE_PATH=/data/live.db and SEED_PATH=/data/findings.json');
  console.log('Importing data from the old site...');
  script('import-site.mjs', IMPORT_FROM, dirname(file));
}

if (CREATE_OWNER_LINK === 'true') {
  try {
    const email = OWNER_EMAIL?.trim().toLowerCase();
    if (!email) throw new Error('Set OWNER_EMAIL.');
    let needed = true;
    if (existsSync(file)) {
      const db = new DatabaseSync(file);
      try {
        db.exec(readFileSync(join('db', 'auth-schema.sql'), 'utf8'));
        const user = db.prepare('SELECT password,disabled FROM auth_users WHERE email=?').get(email);
        needed = !user || (!user.password && !user.disabled);
      } finally { db.close(); }
    } else throw new Error('The database does not exist yet. Restart once after the first start.');
    if (needed) { console.log('OWNER SETUP'); script('editor-access.mjs', email); }
    else console.log('The owner account is already set up. Remove CREATE_OWNER_LINK.');
  } catch (error) { console.error('Could not create the owner link: ' + error.message); }
}

await import(new URL('../server.js', import.meta.url).href);
