import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { readRows } from '@/lib/sheets';
export const runtime = 'nodejs';
export async function GET() {
  if (!await requireAdmin(['Super Admin', 'Admin'])) return NextResponse.json({ success:false, message:'Unauthorized' }, { status:401 });
  try { const rows = await readRows('Orders'); const bookings = rows.slice(1).filter(r => r[0]).map((r,i) => ({ rowNumber:i+2, orderId:String(r[0]), shoeId:String(r[1]??''), name:String(r[2]??''), phone:String(r[3]??''), location:String(r[4]??''), comment:String(r[5]??''), date:String(r[6]??''), status:String(r[7]??'New Enquiry') })).reverse(); return NextResponse.json({ success:true, bookings }); }
  catch (e) { return NextResponse.json({ success:false, message:e instanceof Error ? e.message : 'Unable to load bookings.' }, { status:500 }); }
}
