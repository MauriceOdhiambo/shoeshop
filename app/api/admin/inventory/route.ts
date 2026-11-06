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
    hot: headerColumn(headers, ['Hot Sale', 'HotSale'], 13), sale: headerColumn(headers, ['Sale Price', 'Promotional Price'], 14), reserved: headerColumn(headers, ['Reserved Date'], 15),
  };
}

export async function GET() {
  if (!await requireAdmin(['Super Admin', 'Admin'])) return NextResponse.json({ success: false }, { status: 401 });
  try {
    await ensureInventoryColumns();
    const rows = await readRows('Inventory');
    const c = columns(rows[0] ?? []);
    const shoes = rows.slice(1).filter(r => r[c.id]).map((r, i) => ({
      rowNumber: i + 2, id: String(r[c.id]), picture: driveImageUrl(r[c.picture]), originalPicture: String(r[c.picture] ?? ''),
      buyingPrice: Number(r[c.buying]) || 0, size: String(r[c.size] ?? ''), targetPrice: Number(r[c.target]) || 0,
      status: String(r[c.status] ?? 'Available'), payment: String(r[c.payment] ?? ''), priceSold: Number(r[c.sold]) || 0,
      comment: String(r[c.comment] ?? ''), category: String(r[c.category] ?? 'General'), stockType: r[c.stock],
      hotSale: ['true', 'yes', '1'].includes(String(r[c.hot] ?? '').toLowerCase()), salePrice: Number(r[c.sale]) || 0, reservedDate: String(r[c.reserved] ?? ''),
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
    const buy = Number(b.buyingPrice), target = Number(b.targetPrice), size = String(b.size ?? '').trim();
    if (!size || !Number.isFinite(buy) || buy < 0 || !Number.isFinite(target) || target < 0) return NextResponse.json({ success: false, message: 'Enter a valid size, buying price and selling price.' }, { status: 400 });
    const headers = await ensureInventoryColumns();
    const rows = await readRows('Inventory');
    const c = columns(headers);
    const batch = rows.slice(1).reduce((m, r) => Math.max(m, Number(r[c.stock]) || 0), 0) + 1;
    const row = Array(Math.max(headers.length, 16)).fill('');
    row[c.id] = `SHOE-${crypto.randomUUID()}`; row[c.picture] = String(b.picture ?? ''); row[c.buying] = buy; row[c.size] = size;
    row[c.target] = target; row[c.status] = 'Available'; row[c.comment] = String(b.comment ?? ''); row[c.category] = String(b.category ?? 'General'); row[c.stock] = Number(b.stockType) || batch;
    row[c.hot] = b.hotSale ? 'TRUE' : 'FALSE'; row[c.sale] = Number(b.salePrice) || 0;
    await appendRow('Inventory', row);
    return NextResponse.json({ success: true, id: row[c.id] });
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
    if (b.priceSold !== undefined) { const sold = Number(b.priceSold); if (!Number.isFinite(sold) || sold < 0) return NextResponse.json({ success: false, message: 'Enter a valid sold price.' }, { status: 400 }); row[c.sold] = sold || ''; }
    if (b.payment !== undefined) row[c.payment] = String(b.payment);
    if (b.comment !== undefined) row[c.comment] = String(b.comment);
    if (b.hotSale !== undefined) row[c.hot] = b.hotSale ? 'TRUE' : 'FALSE';
    if (b.salePrice !== undefined) { const sale = Number(b.salePrice); if (!Number.isFinite(sale) || sale < 0) return NextResponse.json({ success: false, message: 'Enter a valid promotional price.' }, { status: 400 }); row[c.sale] = sale || ''; }
    const cost = Number(row[c.buying]) || 0, sold = Number(row[c.sold]) || 0;
    row[c.margin] = sold ? (sold - cost) / sold : '';
    await updateRow('Inventory', index + 1, row);
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Update failed.' }, { status: 500 }); }
}
