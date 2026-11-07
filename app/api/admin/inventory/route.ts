import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { appendRow, driveImageUrl, ensureInventoryColumns, headerColumn, readRows, updateRow } from '@/lib/sheets';
export const runtime = 'nodejs';

function columns(headers: unknown[]) {
  return {
    id: headerColumn(headers, ['ID', 'Shoe ID', 'Item ID'], 0), picture: headerColumn(headers, ['Picture', 'Image', 'Image URL', 'Photo'], 1),
    buying: headerColumn(headers, ['Buying Price', 'Cost Price'], 2), size: headerColumn(headers, ['size', 'Size'], 3),
    target: headerColumn(headers, ['Target Price', 'Selling Price', 'Price'], 4), status: headerColumn(headers, ['Status', 'Stock Status'], 5),
    payment: headerColumn(headers, ['method Payment', 'Payment Method'], 6), sold: headerColumn(headers, ['price sold', 'Sold Price', 'Price Sold'], 7),
    margin: headerColumn(headers, ['Profit Margin'], 8), comment: headerColumn(headers, ['comment', 'Comment'], 9),
    date: headerColumn(headers, ['Date', 'Sold Date'], 10), category: headerColumn(headers, ['Category'], 11), stock: headerColumn(headers, ['Stock Type', 'Batch'], 12),
    hot: headerColumn(headers, ['Hot Sale', 'HotSale'], 13), sale: headerColumn(headers, ['Sale Price', 'Promotional Price'], 14), reserved: headerColumn(headers, ['Reserved Date'], 15), pending: headerColumn(headers, ['Pending Amount', 'Balance Due', 'Outstanding Balance'], 16),
  };
}

export async function GET() {
  const actor = await requireAdmin(['Super Admin', 'Admin']);
  if (!actor) return NextResponse.json({ success: false }, { status: 401 });
  try {
    await ensureInventoryColumns();
    const rows = await readRows('Inventory');
    const c = columns(rows[0] ?? []);
    const shoes = rows.slice(1).filter(r => r[c.id]).map((r, i) => ({
      rowNumber: i + 2, id: String(r[c.id]), picture: driveImageUrl(r[c.picture]), originalPicture: String(r[c.picture] ?? ''),
      ...(actor.role === 'Super Admin' ? { buyingPrice: Number(r[c.buying]) || 0 } : {}), size: String(r[c.size] ?? ''), targetPrice: Number(r[c.target]) || 0,
      status: String(r[c.status] ?? 'Available'), payment: String(r[c.payment] ?? ''), priceSold: Number(r[c.sold]) || 0,
      comment: String(r[c.comment] ?? ''), category: String(r[c.category] ?? 'General'), stockType: r[c.stock],
      hotSale: ['true', 'yes', '1'].includes(String(r[c.hot] ?? '').toLowerCase()), pendingAmount: Number(r[c.pending]) || 0, reservedDate: String(r[c.reserved] ?? ''),
    })).sort((a, b) => {
      const rank = (s: typeof a) => s.status.toLowerCase() === 'available' ? 0 : s.status.toLowerCase() === 'reserved' ? 1 : 2;
      return rank(a) - rank(b) || Number(b.hotSale) - Number(a.hotSale) || a.id.localeCompare(b.id);
    });
    return NextResponse.json({ success: true, shoes });
  } catch (e) { return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Failed' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(['Super Admin', 'Admin'])) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const b = await req.json();
    const actor = await requireAdmin(['Super Admin', 'Admin']);
    if (!actor) return NextResponse.json({ success: false }, { status: 401 });
    const buy = actor.role === 'Super Admin' ? Number(b.buyingPrice) : 0, target = Number(b.targetPrice), size = String(b.size ?? '').trim();
    if (!size || (actor.role === 'Super Admin' && (!Number.isFinite(buy) || buy < 0)) || !Number.isFinite(target) || target < 0) return NextResponse.json({ success: false, message: 'Enter a valid size and selling price.' }, { status: 400 });
    const headers = await ensureInventoryColumns();
    const rows = await readRows('Inventory');
    const c = columns(headers);
    const batch = rows.slice(1).reduce((m, r) => Math.max(m, Number(r[c.stock]) || 0), 0) + 1;
    const picture = String(b.picture ?? '').trim();
    if (!picture) return NextResponse.json({ success: false, message: 'Upload a shoe photo to Google Drive before saving this item.' }, { status: 400 });
    const row = Array(Math.max(headers.length, 17)).fill('');
    // Keep the established Shoe Studio ID format: SHOE-<13-digit timestamp>.
    // Advance by 1ms if an item was already created in the same millisecond.
    let idTimestamp = Date.now();
    const existingIds = new Set(rows.slice(1).map((r) => String(r[c.id] ?? '')));
    while (existingIds.has(`SHOE-${idTimestamp}`)) idTimestamp += 1;
    row[c.id] = `SHOE-${idTimestamp}`; row[c.picture] = picture; row[c.buying] = buy; row[c.size] = size;
    row[c.target] = target; row[c.status] = 'Available'; row[c.comment] = String(b.comment ?? ''); row[c.category] = String(b.category ?? 'General'); row[c.stock] = Number(b.stockType) || batch;
    row[c.hot] = b.hotSale ? 'TRUE' : 'FALSE'; row[c.pending] = 0;
    await appendRow('Inventory', row);
    let subscriberEmailSent = false;
    let subscriberEmailError: string | null = null;
    try {
      const endpoint = process.env.GOOGLE_DRIVE_UPLOAD_WEB_APP_URL?.trim();
      const token = process.env.GOOGLE_DRIVE_UPLOAD_TOKEN?.trim();
      if (!endpoint || !token) throw new Error('Email bridge environment variables are missing.');
      const subscribers = await readRows('Subscribers');
      const sh = subscribers[0] ?? [];
      const emailCol = headerColumn(sh, ['Email'], 0), activeCol = headerColumn(sh, ['Active'], 3), tokenCol = headerColumn(sh, ['Unsubscribe Token'], 4);
      const active = subscribers.slice(1).filter(r => ['true','yes','1','active'].includes(String(r[activeCol] ?? 'TRUE').toLowerCase()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r[emailCol] ?? '').trim()));
      const subscriberMap = new Map<string, { email:string; unsubscribeToken:string }>();
      active.forEach(r => { const email = String(r[emailCol] ?? '').trim().toLowerCase(); const unsubscribeToken = String(r[tokenCol] ?? ''); if (email && unsubscribeToken.length >= 24 && !subscriberMap.has(email)) subscriberMap.set(email, { email, unsubscribeToken }); });
      const subscribersForEmail = [...subscriberMap.values()];
      if (subscribersForEmail.length) {
        const response = await fetch(endpoint, { method:'POST', redirect:'follow', cache:'no-store', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'notifyNewStock', token, subscribers:subscribersForEmail, siteUrl:(process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, ''), shoe:{ id:row[c.id], picture, category:row[c.category], size, price:target } }) });
        const raw = await response.text(); const result = raw ? JSON.parse(raw) : {};
        if (!response.ok || result.success !== true) throw new Error(result.message || `Email bridge returned HTTP ${response.status}.`);
        subscriberEmailSent = true;
      }
    } catch (error) { subscriberEmailError = error instanceof Error ? error.message : 'Could not send new-stock email.'; console.error('New stock email failed:', subscriberEmailError); }
    return NextResponse.json({ success: true, id: row[c.id], subscriberEmailSent, subscriberEmailError });
  } catch (e) { return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Could not add shoe.' }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(['Super Admin', 'Admin'])) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const b = await req.json();
    const headers = await ensureInventoryColumns();
    const rows = await readRows('Inventory');
    const c = columns(headers);
    const index = rows.findIndex((r, i) => i > 0 && String(r[c.id]) === String(b.id));
    if (index < 1) return NextResponse.json({ success: false, message: 'Shoe not found.' }, { status: 404 });
    const row = [...rows[index]]; while (row.length < headers.length) row.push('');
    if (b.status !== undefined) {
      if (!['Available', 'Reserved', 'Sold'].includes(b.status)) return NextResponse.json({ success: false, message: 'Invalid status.' }, { status: 400 });
      if (b.status === 'Sold' && Number(b.priceSold ?? row[c.sold]) <= 0) return NextResponse.json({ success: false, message: 'Enter the actual sold price before marking this shoe as Sold.' }, { status: 400 });
      const previousStatus = String(row[c.status] ?? '').toLowerCase();
      row[c.status] = b.status;
      if (b.status === 'Reserved' && previousStatus !== 'reserved') row[c.reserved] = new Date().toISOString();
      if (b.status === 'Available') row[c.reserved] = '';
      if (b.status === 'Sold' && previousStatus !== 'sold') row[c.date] = new Date().toISOString();
    }
    if (b.buyingPrice !== undefined) {
      const actor = await requireAdmin(['Super Admin']);
      if (!actor) return NextResponse.json({ success: false, message: 'Super Admin access required to view or change buying costs.' }, { status: 403 });
      const buying = Number(b.buyingPrice);
      if (!Number.isFinite(buying) || buying < 0) return NextResponse.json({ success: false, message: 'Enter a valid buying price.' }, { status: 400 });
      row[c.buying] = buying;
    }
    if (b.priceSold !== undefined) { const sold = Number(b.priceSold); if (!Number.isFinite(sold) || sold < 0) return NextResponse.json({ success: false, message: 'Enter a valid sold price.' }, { status: 400 }); row[c.sold] = sold || ''; }
    if (b.payment !== undefined) row[c.payment] = String(b.payment);
    if (b.comment !== undefined) row[c.comment] = String(b.comment);
    if (b.hotSale !== undefined) row[c.hot] = b.hotSale ? 'TRUE' : 'FALSE';
    if (b.pendingAmount !== undefined) { const pending = Number(b.pendingAmount); if (!Number.isFinite(pending) || pending < 0) return NextResponse.json({ success: false, message: 'Enter a valid outstanding balance.' }, { status: 400 }); row[c.pending] = pending || ''; }
    const cost = Number(row[c.buying]) || 0, sold = Number(row[c.sold]) || 0;
    row[c.margin] = sold ? (sold - cost) / sold : '';
    await updateRow('Inventory', index + 1, row);
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Update failed.' }, { status: 500 }); }
}
