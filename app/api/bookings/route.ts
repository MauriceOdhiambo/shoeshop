import { NextRequest, NextResponse } from 'next/server';
import { appendRow, readRows } from '@/lib/sheets';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim(), phone = String(body.phone ?? '').trim(), shoeId = String(body.shoeId ?? '').trim();
    if (!name || !phone || !shoeId) return NextResponse.json({ success:false, message:'Name, phone number and shoe are required.' }, { status:400 });
    if (name.length > 100 || phone.length > 30 || String(body.location ?? '').length > 160 || String(body.comment ?? '').length > 1000) return NextResponse.json({ success:false, message:'Please check the length of the submitted details.' }, { status:400 });
    const inventory = await readRows('Inventory');
    const shoe = inventory.slice(1).find(r => String(r[0]) === shoeId);
    if (!shoe || String(shoe[5] ?? '').toLowerCase() !== 'available') return NextResponse.json({ success:false, message:'This item is no longer available for booking.' }, { status:409 });
    const orderId = `ORD-${Date.now()}`;
    await appendRow('Orders', [orderId, shoeId, name, phone, String(body.location ?? '').trim(), String(body.comment ?? '').trim(), new Date().toISOString(), 'New Enquiry']);
    return NextResponse.json({ success:true, orderId });
  } catch (e) { return NextResponse.json({ success:false, message:e instanceof Error ? e.message : 'Booking could not be submitted.' }, { status:500 }); }
}
