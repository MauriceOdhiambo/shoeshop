import { NextRequest, NextResponse } from 'next/server';
import { headerColumn, readRows, updateRow } from '@/lib/sheets';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') || '';
    if (token.length < 24) return new NextResponse('Invalid unsubscribe link.', {status:400});
    const rows = await readRows('Subscribers'); const h = rows[0] ?? [];
    const tokenCol = headerColumn(h,['Unsubscribe Token'],4), activeCol = headerColumn(h,['Active'],3);
    const index = rows.findIndex((r,i) => i > 0 && String(r[tokenCol] ?? '') === token);
    if (index < 1) return new NextResponse('This unsubscribe link is invalid or has already been used.', {status:404});
    const row = [...rows[index]]; while(row.length <= activeCol) row.push(''); row[activeCol] = 'FALSE';
    await updateRow('Subscribers',index+1,row);
    return new NextResponse('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Shoe Studio · Unsubscribed</title><body style="margin:0;background:#10191f;color:#f4f5f6;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center"><main style="max-width:520px;margin:24px;padding:36px;background:#17232b;border:1px solid #34434c;border-radius:18px;text-align:center"><div style="color:#d18a4e;letter-spacing:3px;font-weight:bold">SHOE STUDIO</div><h1 style="margin-top:28px">You are unsubscribed</h1><p style="color:#b7c1c8;line-height:1.6">You will no longer receive new-stock email updates. You can visit our collection at any time.</p><a href="/" style="display:inline-block;margin-top:18px;padding:13px 20px;border-radius:9px;background:#b97943;color:#fff;text-decoration:none;font-weight:bold">Visit Shoe Studio</a></main></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
  } catch (e) { return new NextResponse(e instanceof Error ? e.message : 'Could not unsubscribe.',{status:500}); }
}
