import { NextRequest, NextResponse } from 'next/server';
import { getAdmin, hashPassword, verifyAdmin } from '@/lib/auth';
import { readRows, updateRow } from '@/lib/sheets';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const actor = await getAdmin();
  if (!actor) return NextResponse.json({ success: false, message: 'Please sign in again.' }, { status: 401 });
  try {
    const body = await req.json();
    const currentPassword = String(body.currentPassword ?? '');
    const newPassword = String(body.newPassword ?? '');
    if (newPassword.length < 12 || newPassword.length > 256) {
      return NextResponse.json({ success: false, message: 'Your new password must be at least 12 characters.' }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ success: false, message: 'Choose a password different from your current password.' }, { status: 400 });
    }
    if (!await verifyAdmin(actor.username, currentPassword)) {
      return NextResponse.json({ success: false, message: 'Your current password is incorrect.' }, { status: 400 });
    }
    const rows = await readRows('Admins');
    const headers = (rows[0] ?? []).map((v) => String(v).trim().toLowerCase());
    const usernameCol = headers.indexOf('username');
    const hashCol = headers.indexOf('passwordhash');
    const saltCol = headers.indexOf('salt');
    if ([usernameCol, hashCol, saltCol].some((i) => i < 0)) throw new Error('Admins sheet is missing required password columns.');
    const rowIndex = rows.findIndex((r, i) => i > 0 && String(r[usernameCol] ?? '').trim().toLowerCase() === actor.username.toLowerCase());
    if (rowIndex < 1) return NextResponse.json({ success: false, message: 'Administrator account was not found.' }, { status: 404 });
    const { salt, passwordHash } = await hashPassword(newPassword);
    const row = [...rows[rowIndex]];
    row[hashCol] = passwordHash;
    row[saltCol] = salt;
    await updateRow('Admins', rowIndex + 1, row);
    return NextResponse.json({ success: true, message: 'Your password has been updated successfully.' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Could not update your password.' }, { status: 500 });
  }
}
