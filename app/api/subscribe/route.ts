import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { appendRow, headerColumn, readRows } from '@/lib/sheets';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim().slice(0,100);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ success:false, message:'Enter a valid email address.' }, { status:400 });
    const rows = await readRows('Subscribers');
    const headers = rows[0] ?? [];
    const emailCol = headerColumn(headers,['Email'],0), activeCol = headerColumn(headers,['Active'],3);
    const existing = rows.slice(1).find((r) => String(r[emailCol] ?? '').trim().toLowerCase() === email);
    if (existing && String(existing[activeCol] ?? 'TRUE').toLowerCase() !== 'false') return NextResponse.json({ success:true, message:'This email is already subscribed.' });
    const token = randomBytes(24).toString('hex');
    if (existing) return NextResponse.json({ success:false, message:'This address was previously unsubscribed. Please contact Shoe Studio to reactivate it.' }, { status:409 });
    await appendRow('Subscribers',[email,name,new Date().toISOString(),'TRUE',token]);
    return NextResponse.json({ success:true, message:'You are subscribed to new-stock updates.' });
  } catch (e) { return NextResponse.json({ success:false, message:e instanceof Error ? e.message : 'Subscription could not be saved.' }, { status:500 }); }
}
