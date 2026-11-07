import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { driveImageUrl, headerColumn, readRows } from '@/lib/sheets';
export const runtime = 'nodejs';
export async function GET() {
  if (!await requireAdmin(['Super Admin', 'Admin'])) return NextResponse.json({ success:false, message:'Unauthorized' }, { status:401 });
  try {
    const [orders, inventory] = await Promise.all([readRows('Orders'), readRows('Inventory')]);
    const oh = orders[0] ?? [], ih = inventory[0] ?? [];
    const oc = { id:headerColumn(oh,['Order ID'],0), shoe:headerColumn(oh,['Shoe ID'],1), name:headerColumn(oh,['Customer Name'],2), phone:headerColumn(oh,['Phone'],3), location:headerColumn(oh,['Location'],4), comment:headerColumn(oh,['Comment'],5), date:headerColumn(oh,['Date'],6), status:headerColumn(oh,['Status'],7) };
    const ic = { id:headerColumn(ih,['ID','Shoe ID'],0), picture:headerColumn(ih,['Picture','Image','Photo'],1), category:headerColumn(ih,['Category'],11), size:headerColumn(ih,['size','Size'],3) };
    const shoeById = new Map(inventory.slice(1).map((r) => [String(r[ic.id] ?? ''), r]));
    const bookings = orders.slice(1).filter(r => r[oc.id]).map((r,i) => {
      const shoe = shoeById.get(String(r[oc.shoe] ?? '')) ?? [];
      return { rowNumber:i+2, orderId:String(r[oc.id]), shoeId:String(r[oc.shoe]??''), name:String(r[oc.name]??''), phone:String(r[oc.phone]??''), location:String(r[oc.location]??''), comment:String(r[oc.comment]??''), date:String(r[oc.date]??''), status:String(r[oc.status]??'New Enquiry'), picture:driveImageUrl(shoe[ic.picture]), category:String(shoe[ic.category]??'Shoe'), size:String(shoe[ic.size]??'') };
    }).reverse();
    return NextResponse.json({ success:true, bookings });
  } catch (e) { return NextResponse.json({ success:false, message:e instanceof Error ? e.message : 'Unable to load bookings.' }, { status:500 }); }
}
