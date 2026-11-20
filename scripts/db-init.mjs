import {execFileSync} from 'node:child_process';
import './sites-env.mjs';
const remote=process.argv.includes('--remote');
const args=['./node_modules/wrangler/bin/wrangler.js','d1','execute','DB',remote?'--remote':'--local','--config',remote?'cloudflare/wrangler.json':'dist/server/wrangler.json',...(!remote?['--persist-to','.wrangler/state']:[]),'--yes'];
execFileSync(process.execPath,[...args,'--command','CREATE TABLE IF NOT EXISTS updates (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)'],{stdio:'inherit'});
for(const name of ['auth','requests','items','deletions'])execFileSync(process.execPath,[...args,'--file',`cloudflare/${name}-schema.sql`],{stdio:'inherit'});
