import { env } from '../../../lib/env';
import { publicOrigin } from '../../../lib/request';
import { getEditor, isOwner, digest, token } from '../../../lib/auth';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
type User = { email: string; active: number };

// Only the configured owner can see or change who has access.
export async function GET() {
  if (!isOwner(await getEditor())) return json({ error: 'Only the tracker owner can manage access.' }, 403);
  const { results } = await env.DB.prepare('SELECT email,(password IS NOT NULL) AS active FROM auth_users WHERE disabled=0 ORDER BY email').all<User>();
  return json({ users: results.map(row => ({ email: row.email, active: Boolean(row.active), owner: isOwner(row) })) });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (req.headers.get('origin') !== publicOrigin(req)) return json({ error: 'Invalid request origin.' }, 403);
  const owner = await getEditor();
  if (!owner || !isOwner(owner)) return json({ error: 'Only the tracker owner can manage access.' }, 403);
  if (raw.length > 4096) return json({ error: 'Request too large.' }, 413);
  let body: { action?: unknown; email?: unknown } | null;
  try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'Invalid request.' }, 400);
  const now = new Date().toISOString();

  if (body.action === 'remove-all') {
    await env.DB.batch([
      env.DB.prepare('UPDATE auth_users SET disabled=1,password=NULL,setup_hash=NULL,setup_expires=NULL WHERE email<>?').bind(owner.email),
      env.DB.prepare('DELETE FROM auth_sessions WHERE email<>?').bind(owner.email),
      env.DB.prepare("UPDATE access_requests SET status='declined',reviewed_at=?,reviewed_by=? WHERE status='approved' AND email<>?").bind(now, owner.email, owner.email),
    ]);
    return json({ ok: true });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[-a-z0-9._+]+@[-a-z0-9.]+\.[a-z]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
  const existing = await env.DB.prepare('SELECT email,(password IS NOT NULL) AS active FROM auth_users WHERE email=? AND disabled=0').bind(email).first<User>();

  if (body.action === 'remove') {
    if (isOwner({ email })) return json({ error: 'The owner account cannot be removed.' }, 400);
    if (!existing) return json({ error: 'This person does not have access.' }, 404);
    // Clearing the password and any setup link means returning needs a new invitation.
    await env.DB.batch([
      env.DB.prepare('UPDATE auth_users SET disabled=1,password=NULL,setup_hash=NULL,setup_expires=NULL WHERE email=?').bind(email),
      env.DB.prepare('DELETE FROM auth_sessions WHERE email=?').bind(email),
      env.DB.prepare("UPDATE access_requests SET status='declined',reviewed_at=?,reviewed_by=? WHERE email=?").bind(now, owner.email, email),
    ]);
    return json({ ok: true });
  }

  if (body.action !== 'add' && body.action !== 'link') return json({ error: 'Unknown action.' }, 400);
  if (body.action === 'add' && existing) return json({ error: 'This person is already in the list. Use New setup link instead.' }, 409);
  if (body.action === 'link' && !existing) return json({ error: 'This person does not have access.' }, 404);
  const secret = token();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO auth_users(email,setup_hash,setup_expires) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET setup_hash=excluded.setup_hash,setup_expires=excluded.setup_expires,disabled=0').bind(email, digest(secret), Date.now() + 86400000),
    env.DB.prepare("UPDATE access_requests SET status='approved',reviewed_at=?,reviewed_by=? WHERE email=?").bind(now, owner.email, email),
  ]);
  return json({ ok: true, setupUrl: new URL('/setup', publicOrigin(req)).href + '#email=' + encodeURIComponent(email) + '&token=' + secret });
}
