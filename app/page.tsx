import { redirect } from 'next/navigation';
import { getEditor, isOwner } from '../lib/auth';
import Tracker from './tracker';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getEditor();
  if (!user) redirect('/login');
  return <Tracker owner={isOwner(user)} />;
}
