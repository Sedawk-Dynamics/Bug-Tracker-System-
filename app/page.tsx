import { getEditor, isOwner } from '../lib/auth';
import Tracker from './tracker';

export const dynamic = 'force-dynamic';

// Anyone can view; signing in only unlocks editing.
export default async function Page() {
  const user = await getEditor();
  return <Tracker signedIn={Boolean(user)} owner={isOwner(user)} />;
}
