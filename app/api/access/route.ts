import {getEditor,isOwner} from '../../../lib/auth';
export const dynamic='force-dynamic';
export async function GET(){const user=await getEditor();return Response.json({signedIn:!!user,canEdit:!!user,isOwner:isOwner(user)},{headers:{'Cache-Control':'no-store'}})}
