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
    return new NextResponse('<!doctype html><html><body style="font-family:Arial;padding:40px;color:#17232b"><h1>You are unsubscribed</h1><p>You will no longer receive Shoe Studio new-stock emails.</p></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
  } catch (e) { return new NextResponse(e instanceof Error ? e.message : 'Could not unsubscribe.',{status:500}); }
}
