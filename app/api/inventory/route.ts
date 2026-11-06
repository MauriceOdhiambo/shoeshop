import { NextResponse } from 'next/server';
import { driveImageUrl, ensureInventoryColumns, headerColumn, readRows } from '@/lib/sheets';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // The public catalogue only needs Inventory. Do not make the shop disappear just because
    // the optional Orders tab is temporarily unavailable.
    await ensureInventoryColumns();
    const inventory = await readRows('Inventory');
    if (!inventory.length) return NextResponse.json({ success: true, shoes: [], categories: [], sizes: [], message: 'The Inventory tab is empty or has no header row.' });
    const headers = inventory[0];
    const col = {
      id: headerColumn(headers, ['ID', 'Shoe ID', 'Item ID'], 0),
      picture: headerColumn(headers, ['Picture', 'Image', 'Image URL', 'Photo'], 1),
      size: headerColumn(headers, ['size', 'Size'], 3),
      targetPrice: headerColumn(headers, ['Target Price', 'Selling Price', 'Price'], 4),
      status: headerColumn(headers, ['Status', 'Stock Status'], 5),
      category: headerColumn(headers, ['Category', 'Shoe Category'], 11),
      stockType: headerColumn(headers, ['Stock Type', 'Batch', 'Batch Number'], 12),
      hotSale: headerColumn(headers, ['Hot Sale', 'HotSale'], 13),
      salePrice: headerColumn(headers, ['Sale Price', 'Promotional Price'], 14),
    };
    const shoes = inventory.slice(1).filter((r) => String(r[col.id] ?? '').trim()).map((r) => ({
      id: String(r[col.id]).trim(),
      picture: driveImageUrl(r[col.picture]),
      originalPicture: String(r[col.picture] ?? '').trim().replace(/&amp;/gi, '&'),
      size: r[col.size] ?? '',
      targetPrice: Number(String(r[col.targetPrice] ?? '').replace(/[, KSh]/g, '')) || 0,
      status: String(r[col.status] ?? 'Available').trim() || 'Available',
      category: String(r[col.category] ?? 'General').trim() || 'General',
      stockType: Number(r[col.stockType]) || 1,
      hotSale: ['true', 'yes', '1'].includes(String(r[col.hotSale] ?? '').toLowerCase()),
      salePrice: Number(r[col.salePrice]) || 0,
    })).sort((a, b) => {
      const rank = (s: typeof a) => s.status.toLowerCase() === 'available' ? 0 : s.status.toLowerCase() === 'reserved' ? 1 : 2;
      return rank(a) - rank(b) || Number(b.hotSale) - Number(a.hotSale) || a.id.localeCompare(b.id);
    });
    const categories = [...new Set(shoes.map((s) => s.category))].sort();
    const sizes = [...new Set(shoes.map((s) => String(s.size)))].sort((a, b) => Number(a) - Number(b));
    return NextResponse.json({ success: true, shoes, categories, sizes });
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Unable to load stock from Google Sheets.' }, { status: 500 });
  }
}
