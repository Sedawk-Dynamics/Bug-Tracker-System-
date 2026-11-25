// Rebuilds the original findings.json from the old site's /api/items response when that file is not available.
import { readFileSync, writeFileSync } from 'node:fs';

const [output, ...inputs] = process.argv.slice(2);
if (!output || !inputs.length) throw new Error('Usage: node scripts/recover-findings.mjs findings.json items.json [deleted.json]');
const runtime = ['status', 'owner', 'notes', 'version', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy'];
const found = new Map();
for (const input of inputs)
  for (const item of JSON.parse(readFileSync(input, 'utf8').replace(/^﻿/, '')))
    if (!item.id.startsWith('NEW-')) found.set(item.id, Object.fromEntries(Object.entries(item).filter(([key]) => !runtime.includes(key))));
writeFileSync(output, JSON.stringify([...found.values()], null, 2), { flag: 'wx' });
console.log(`Recovered ${found.size} original items.`);
