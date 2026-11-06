import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { readRows, updateRow } from '@/lib/sheets';
export const runtime = 'nodejs';
export async function PATCH(req: NextRequest, ctx: { params: Promise<{id:string}> }) {
  if (!await requireAdmin(['Super Admin', 'Admin'])) return NextResponse.json({ success:false, message:'Unauthorized' }, { status:401 });
  try { const { id } = await ctx.params; const { status } = await req.json(); if (!['New Enquiry','Confirmed','Completed','Cancelled'].includes(status)) return NextResponse.json({ success:false, message:'Invalid booking status.' }, { status:400 }); const rows = await readRows('Orders'); const index = rows.findIndex((r,i) => i>0 && String(r[0])===id); if (index<1) return NextResponse.json({ success:false, message:'Booking not found.' }, { status:404 }); const updated=[...rows[index]]; updated[7]=status; await updateRow('Orders', index+1, updated); return NextResponse.json({ success:true }); }
  catch(e) { return NextResponse.json({ success:false, message:e instanceof Error ? e.message : 'Update failed.' }, { status:500 }); }
}
