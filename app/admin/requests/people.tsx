'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

type User = { email: string; active: boolean; owner: boolean };
type Result = { error?: string; users?: User[]; setupUrl?: string };

// `signal` changes whenever the request list reloads, so approvals show up here too.
export default function People({ signal, onChanged }: { signal: unknown; onChanged: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/users', { cache: 'no-store' });
      const data = await response.json() as Result;
      if (!response.ok) throw new Error(data.error);
      setUsers(data.users ?? []);
    } catch (e) { setError((e as Error).message); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server, then stores the result
  useEffect(() => { void load(); }, [load, signal]);

  async function run(action: string, target?: string) {
    if (busy) return false;
    setBusy(true); setError(''); setInvite(null); setCopied(false);
    try {
      const response = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, email: target }) });
      const data = await response.json() as Result;
      if (!response.ok) throw new Error(data.error);
      if (data.setupUrl && target) setInvite({ email: target, url: data.setupUrl });
      await load();
      onChanged();
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }
  async function add(event: FormEvent) {
    event.preventDefault();
    if (await run('add', email.trim().toLowerCase())) setEmail('');
  }
  async function copy() {
    if (!invite) return;
    try { await navigator.clipboard.writeText(invite.url); setCopied(true); }
    catch { setError('Copy the link from the field manually.'); }
  }

  const others = users.filter(user => !user.owner);
  return <section>
    <h2 className="requests-heading">People with access ({users.length})</h2>
    <p>People you add can add, edit, delete and restore every item. Only you can manage access.</p>
    <form onSubmit={add}>
      <label>Email of the person to add<input required type="email" maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <button className="primary" style={{ marginTop: 12 }} disabled={busy}>Add person</button>
    </form>
    {error && <div className="error" role="alert">{error}</div>}
    {invite && <section className="access-notice" role="status">
      <h2>Setup link for {invite.email}</h2>
      <p>Send this private link to them yourself. It works once and expires in 24 hours.</p>
      <label>Private setup link<input readOnly value={invite.url} onFocus={e => e.target.select()} /></label>
      <button className="primary" onClick={copy}>{copied ? 'Copied' : 'Copy setup link'}</button>
      <button className="secondary" onClick={() => setInvite(null)}>Hide link</button>
    </section>}
    {users.map(user => <article className="request-row" key={user.email}>
      <h3>{user.email}</h3>
      <p>{user.owner ? 'Owner (admin)' : user.active ? 'Can edit' : 'Invited, password not set yet'}</p>
      {!user.owner && <div>
        <button className="secondary" disabled={busy} onClick={() => run('link', user.email)}>New setup link</button>
        <button className="secondary" disabled={busy} onClick={() => { if (confirm('Remove access for ' + user.email + '? They are signed out immediately.')) void run('remove', user.email); }}>Remove access</button>
      </div>}
    </article>)}
    {others.length > 0 && <button className="secondary" disabled={busy} onClick={() => { if (confirm('Remove access for all ' + others.length + ' other people? Only you will be able to edit.')) void run('remove-all'); }}>Remove everyone except me</button>}
  </section>;
}
