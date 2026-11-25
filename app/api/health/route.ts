import { env } from '@/lib/env';
export const dynamic = 'force-dynamic';
export async function GET() { await env.DB.prepare('SELECT 1').first(); return Response.json({ ok: true }); }
