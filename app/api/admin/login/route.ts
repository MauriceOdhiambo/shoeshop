import { NextRequest, NextResponse } from 'next/server';
import { createSession, verifyAdmin } from '@/lib/auth';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username ?? '');
    const password = String(body.password ?? '');
    const admin = await verifyAdmin(username, password);
    if (!admin) return NextResponse.json({ success: false, message: 'Invalid username or password, or this account is inactive.' }, { status: 401 });
    await createSession(admin.username);
    return NextResponse.json({ success: true, admin });
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Sign in failed.' }, { status: 500 });
  }
}
