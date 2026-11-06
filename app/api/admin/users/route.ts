import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, requireAdmin } from '@/lib/auth';
import { appendRow, readRows, updateRow } from '@/lib/sheets';
export const runtime = 'nodejs';

const HEADERS = ['Username', 'PasswordHash', 'Salt', 'Role', 'Active'];
function headerIndex(headers: string[], name: string) { return headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase()); }

export async function GET() {
  const actor = await requireAdmin(['Super Admin']);
  if (!actor) return NextResponse.json({ success: false, message: 'Super Admin access required.' }, { status: 403 });
  try {
    const rows = await readRows('Admins');
    const headers = (rows[0] ?? []).map(String);
    const indexes = Object.fromEntries(HEADERS.map((h) => [h, headerIndex(headers, h)])) as Record<string, number>;
    if (Object.values(indexes).some((i) => i < 0)) return NextResponse.json({ success: false, message: 'Admins sheet is not configured. Run npm run admins:setup.' }, { status: 500 });
    const admins = rows.slice(1).map((r, i) => ({
      username: String(r[indexes.Username] ?? ''),
      role: String(r[indexes.Role] ?? 'Admin'),
      active: ['true', '1', 'yes', 'active'].includes(String(r[indexes.Active] ?? '').trim().toLowerCase()),
      rowNumber: i + 2,
    })).filter((a) => a.username);
    return NextResponse.json({ success: true, admins });
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Unable to load administrators.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(['Super Admin']);
  if (!actor) return NextResponse.json({ success: false, message: 'Super Admin access required.' }, { status: 403 });
  try {
    const body = await req.json();
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const role = String(body.role ?? 'Admin');
    if (!/^[a-zA-Z0-9._-]{2,40}$/.test(username)) return NextResponse.json({ success: false, message: 'Username must be 2–40 characters and use letters, numbers, dots, underscores or hyphens.' }, { status: 400 });
    if (!['Admin', 'Super Admin'].includes(role)) return NextResponse.json({ success: false, message: 'Invalid administrator role.' }, { status: 400 });
    const rows = await readRows('Admins');
    const headers = (rows[0] ?? []).map(String);
    const usernameCol = headerIndex(headers, 'Username');
    if (usernameCol < 0) return NextResponse.json({ success: false, message: 'Admins sheet is not configured. Run npm run admins:setup.' }, { status: 500 });
    if (rows.slice(1).some((r) => String(r[usernameCol] ?? '').trim().toLowerCase() === username.toLowerCase())) return NextResponse.json({ success: false, message: 'That username already exists.' }, { status: 409 });
    const { salt, passwordHash } = await hashPassword(password);
    await appendRow('Admins', [username, passwordHash, salt, role, 'TRUE']);
    return NextResponse.json({ success: true, message: `Administrator ${username} created.` });
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Could not create administrator.' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdmin(['Super Admin']);
  if (!actor) return NextResponse.json({ success: false, message: 'Super Admin access required.' }, { status: 403 });
  try {
    const body = await req.json();
    const username = String(body.username ?? '').trim();
    if (!username) return NextResponse.json({ success: false, message: 'Username is required.' }, { status: 400 });
    if (username.toLowerCase() === actor.username.toLowerCase() && (body.active === false || body.role === 'Admin')) {
      return NextResponse.json({ success: false, message: 'You cannot deactivate or demote your own Super Admin account.' }, { status: 400 });
    }
    const rows = await readRows('Admins');
    const headers = (rows[0] ?? []).map(String);
    const col = (name: string) => headerIndex(headers, name);
    const indexes = ['Username', 'PasswordHash', 'Salt', 'Role', 'Active'].map(col);
    if (indexes.some((i) => i < 0)) return NextResponse.json({ success: false, message: 'Admins sheet is not configured. Run npm run admins:setup.' }, { status: 500 });
    const rowIndex = rows.findIndex((r, i) => i > 0 && String(r[indexes[0]] ?? '').trim().toLowerCase() === username.toLowerCase());
    if (rowIndex < 1) return NextResponse.json({ success: false, message: 'Administrator not found.' }, { status: 404 });
    const row = [...rows[rowIndex]];
    if (body.role !== undefined) {
      if (!['Admin', 'Super Admin'].includes(String(body.role))) return NextResponse.json({ success: false, message: 'Invalid role.' }, { status: 400 });
      row[indexes[3]] = String(body.role);
    }
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') return NextResponse.json({ success: false, message: 'Active must be true or false.' }, { status: 400 });
      row[indexes[4]] = body.active ? 'TRUE' : 'FALSE';
    }
    if (body.password !== undefined) {
      const { salt, passwordHash } = await hashPassword(String(body.password));
      row[indexes[1]] = passwordHash;
      row[indexes[2]] = salt;
    }
    await updateRow('Admins', rowIndex + 1, row);
    return NextResponse.json({ success: true, message: `Administrator ${username} updated.` });
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Could not update administrator.' }, { status: 400 });
  }
}
