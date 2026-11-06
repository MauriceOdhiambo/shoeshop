import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/auth';
export const runtime = 'nodejs';
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ success: true, admin });
}
