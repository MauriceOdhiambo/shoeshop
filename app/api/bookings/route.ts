import { NextRequest, NextResponse } from 'next/server';
import { appendRow, headerColumn, readRows, updateRow } from '@/lib/sheets';
export const runtime = 'nodejs';

function normalizePhone(value: unknown) { return String(value ?? '').replace(/\D/g, ''); }
async function notifyAdmins(payload: Record<string, unknown>) {
  const endpoint = process.env.GOOGLE_DRIVE_UPLOAD_WEB_APP_URL?.trim();
  const token = process.env.GOOGLE_DRIVE_UPLOAD_TOKEN?.trim();
  if (!endpoint || !token) return false;
  try {
    const admins = await readRows('Admins');
    const headers = admins[0] ?? [];
    const emailCol = headerColumn(headers, ['mail', 'email', 'e-mail'], -1);
    const activeCol = headerColumn(headers, ['Active', 'Status'], -1);
    const recipients = [...new Set(admins.slice(1).filter((r) => activeCol < 0 || ['true','yes','1','active'].includes(String(r[activeCol] ?? '').trim().toLowerCase())).map((r) => String(emailCol >= 0 ? r[emailCol] ?? '' : '').trim()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
    if (!recipients.length) return false;
    const response = await fetch(endpoint, { method:'POST', redirect:'follow', cache:'no-store', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'notifyOrder', token, recipients, order:payload }) });
    const raw = await response.text();
    const result = raw ? JSON.parse(raw) : {};
    return response.ok && result.success === true;
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim(), phone = String(body.phone ?? '').trim(), shoeId = String(body.shoeId ?? '').trim();
    const location = String(body.location ?? '').trim(), comment = String(body.comment ?? '').trim();
    if (!name || !phone || !shoeId) return NextResponse.json({ success:false, message:'Name, phone number and shoe are required.' }, { status:400 });
    if (name.length > 100 || phone.length > 30 || location.length > 160 || comment.length > 1000) return NextResponse.json({ success:false, message:'Please check the length of the submitted details.' }, { status:400 });
    const inventory = await readRows('Inventory');
    const ih = inventory[0] ?? [];
    const ic = { id:headerColumn(ih,['ID','Shoe ID'],0), picture:headerColumn(ih,['Picture','Image','Photo'],1), buying:headerColumn(ih,['Buying Price'],2), size:headerColumn(ih,['size','Size'],3), target:headerColumn(ih,['Target Price'],4), status:headerColumn(ih,['Status'],5), category:headerColumn(ih,['Category'],11), hot:headerColumn(ih,['Hot Sale','HotSale'],13) };
    const shoeIndex = inventory.findIndex((r,i) => i > 0 && String(r[ic.id] ?? '') === shoeId);
    if (shoeIndex < 1) return NextResponse.json({ success:false, message:'This shoe could not be found.' }, { status:404 });
    const shoe = inventory[shoeIndex];
    if (String(shoe[ic.status] ?? '').toLowerCase() !== 'available') return NextResponse.json({ success:false, message:'This item is no longer available for booking.' }, { status:409 });
    const orders = await readRows('Orders');
    const oh = orders[0] ?? [];
    const oc = { id:headerColumn(oh,['Order ID'],0), shoe:headerColumn(oh,['Shoe ID'],1), phone:headerColumn(oh,['Phone'],3) };
    const orderId = `ORD-${Date.now()}`;
    const orderDate = new Date().toISOString();
    await appendRow('Orders', [orderId, shoeId, name, phone, location, comment, orderDate, 'New Enquiry']);

    // Promote only when at least two distinct customer phone numbers have enquired about this exact pair.
    const uniqueCustomers = new Set(orders.slice(1).filter((r) => String(r[oc.shoe] ?? '') === shoeId).map((r) => normalizePhone(r[oc.phone])).filter(Boolean));
    uniqueCustomers.add(normalizePhone(phone));
    if (uniqueCustomers.size >= 2 && ic.hot >= 0) {
      const updatedShoe = [...shoe]; while (updatedShoe.length <= ic.hot) updatedShoe.push('');
      updatedShoe[ic.hot] = 'TRUE';
      await updateRow('Inventory', shoeIndex + 1, updatedShoe);
    }

    const picture = String(shoe[ic.picture] ?? '');
    const emailSent = await notifyAdmins({ orderId, orderDate, customerName:name, customerPhone:phone, customerLocation:location, customerComment:comment, shoeId, shoeCategory:String(shoe[ic.category]??'Shoe'), shoeSize:String(shoe[ic.size]??''), shoePrice:String(shoe[ic.target]??''), shoePicture:picture });
    return NextResponse.json({ success:true, orderId, emailSent });
  } catch (e) { return NextResponse.json({ success:false, message:e instanceof Error ? e.message : 'Booking could not be submitted.' }, { status:500 }); }
}
