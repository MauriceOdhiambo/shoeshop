import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { appendRow, headerColumn, readRows, updateRow } from '@/lib/sheets';
export const runtime = 'nodejs';

function normalizePhone(value: unknown) { return String(value ?? '').replace(/\D/g, ''); }
function validEmail(value: unknown) { const email = String(value ?? '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''; }
async function addSubscriber(email: string, name: string) {
  if (!email) return;
  try {
    const rows = await readRows('Subscribers');
    const headers = rows[0] ?? [];
    const emailCol = headerColumn(headers, ['Email'], 0);
    const activeCol = headerColumn(headers, ['Active'], 3);
    const exists = rows.slice(1).some((r) => String(r[emailCol] ?? '').trim().toLowerCase() === email && String(r[activeCol] ?? 'TRUE').toLowerCase() !== 'false');
    if (!exists) await appendRow('Subscribers', [email, name, new Date().toISOString(), 'TRUE', UtilitiesToken_()]);
  } catch (error) { console.error('Subscriber save failed:', error); }
}
function UtilitiesToken_() { return randomBytes(24).toString('hex'); }
async function notifyAdmins(payload: Record<string, unknown>): Promise<{ sent: boolean; error?: string }> {
  const endpoint = process.env.GOOGLE_DRIVE_UPLOAD_WEB_APP_URL?.trim();
  const token = process.env.GOOGLE_DRIVE_UPLOAD_TOKEN?.trim();
  if (!endpoint || !token) return { sent:false, error:'Missing GOOGLE_DRIVE_UPLOAD_WEB_APP_URL or GOOGLE_DRIVE_UPLOAD_TOKEN in Vercel.' };
  try {
    const admins = await readRows('Admins');
    const headers = admins[0] ?? [];
    const emailCol = headerColumn(headers, ['mail', 'email', 'e-mail', 'notification email', 'email address'], -1);
    const activeCol = headerColumn(headers, ['Active', 'Status'], -1);
    if (emailCol < 0) return { sent:false, error:'Admins sheet has no mail or Email column.' };
    const recipients = [...new Set(admins.slice(1).filter((r) => activeCol < 0 || ['true','yes','1','active'].includes(String(r[activeCol] ?? '').trim().toLowerCase())).map((r) => String(r[emailCol] ?? '').trim().toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
    if (!recipients.length) return { sent:false, error:'No valid email addresses found in active Admins rows.' };
    const response = await fetch(endpoint, { method:'POST', redirect:'follow', cache:'no-store', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'notifyOrder', token, recipients, order:payload }) });
    const raw = await response.text();
    let result: any = {};
    try { result = raw ? JSON.parse(raw) : {}; } catch { return { sent:false, error:`Apps Script returned a non-JSON response (HTTP ${response.status}). Redeploy the latest Web App version and verify its /exec URL.` }; }
    if (!response.ok || result.success !== true) return { sent:false, error:String(result.message || `Apps Script rejected email request (HTTP ${response.status}).`) };
    if (Number(result.sentTo || 0) < 1) return { sent:false, error:'Apps Script accepted the request but did not confirm any email recipients.' };
    return { sent:true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not contact the email service.';
    console.error('Shoe Studio admin email notification failed:', message);
    return { sent:false, error:message };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim(), phone = String(body.phone ?? '').trim(), shoeId = String(body.shoeId ?? '').trim();
    const location = String(body.location ?? '').trim(), comment = String(body.comment ?? '').trim();
    const customerEmail = validEmail(body.email);
    if (body.email && !customerEmail) return NextResponse.json({ success:false, message:'Please enter a valid email address.' }, { status:400 });
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
    if (customerEmail && body.subscribeNewStock === true) await addSubscriber(customerEmail, name);

    // Promote only when at least two distinct customer phone numbers have enquired about this exact pair.
    const uniqueCustomers = new Set(orders.slice(1).filter((r) => String(r[oc.shoe] ?? '') === shoeId).map((r) => normalizePhone(r[oc.phone])).filter(Boolean));
    uniqueCustomers.add(normalizePhone(phone));
    if (uniqueCustomers.size >= 2 && ic.hot >= 0) {
      const updatedShoe = [...shoe]; while (updatedShoe.length <= ic.hot) updatedShoe.push('');
      updatedShoe[ic.hot] = 'TRUE';
      await updateRow('Inventory', shoeIndex + 1, updatedShoe);
    }

    const picture = String(shoe[ic.picture] ?? '');
    const notification = await notifyAdmins({ orderId, orderDate, customerName:name, customerPhone:phone, customerEmail, customerLocation:location, customerComment:comment, shoeId, shoeCategory:String(shoe[ic.category]??'Shoe'), shoeSize:String(shoe[ic.size]??''), shoePrice:String(shoe[ic.target]??''), shoePicture:picture });
    if (!notification.sent) console.error('Shoe Studio admin order email was not sent:', { orderId, error: notification.error });
    else console.info('Shoe Studio admin order email sent:', { orderId });
    return NextResponse.json({ success:true, orderId, emailSent:notification.sent, emailError:notification.error || null, subscribed:!!(customerEmail && body.subscribeNewStock === true) });
  } catch (e) { return NextResponse.json({ success:false, message:e instanceof Error ? e.message : 'Booking could not be submitted.' }, { status:500 }); }
}
