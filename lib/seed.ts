import { readFileSync } from 'node:fs';
import demo from '../data/findings.json';

type Seed = { id: string; kind: string; title: string; area: string; severity?: string; [key: string]: string | undefined };
let cached: Seed[] | undefined;

// Real records stay out of the public repository: SEED_PATH points at a private file on the server's volume.
export function getSeed(): Seed[] {
  if (cached) return cached;
  const file = process.env.SEED_PATH;
  return (cached = file ? JSON.parse(readFileSync(/* turbopackIgnore: true */ file, 'utf8').replace(/^﻿/, '')) as Seed[] : demo as Seed[]);
}
