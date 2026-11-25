import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';

const email = process.argv[2]?.trim().toLowerCase();
const disable = process.argv.includes('--disable');
if (!email || !/^[-a-z0-9._+]+@[-a-z0-9.]+\.[a-z]+$/.test(email)) throw new Error('Provide a valid editor email.');
if (!process.env.PUBLIC_URL) throw new Error('Set PUBLIC_URL.');
const db = new DatabaseSync(process.env.DATABASE_PATH || './storage/tracker.db');
db.exec('PRAGMA busy_timeout=5000');
if (disable) {
  db.prepare('UPDATE auth_users SET disabled=1,setup_hash=NULL WHERE email=?').run(email);
  db.prepare('DELETE FROM auth_sessions WHERE email=?').run(email);
  console.log('Editor disabled and sessions revoked.');
} else {
  const secret = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO auth_users(email,setup_hash,setup_expires) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET setup_hash=excluded.setup_hash,setup_expires=excluded.setup_expires,disabled=0')
    .run(email, createHash('sha256').update(secret).digest('hex'), Date.now() + 86400000);
  console.log('Private link, valid 24 hours:\n' + new URL('/setup', process.env.PUBLIC_URL).href + '#email=' + encodeURIComponent(email) + '&token=' + secret);
}
