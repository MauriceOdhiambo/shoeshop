import { NextResponse } from 'next/server';
import { readRows } from '@/lib/sheets';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const config = {
    spreadsheetIdPresent: Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()),
    serviceAccountPresent: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64),
    sessionSecretPresent: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32),
  };
  try {
    const rows = await readRows('Inventory');
    return NextResponse.json({ ok: true, configuration: config, googleSheets: 'connected', inventoryRows: Math.max(0, rows.length - 1), inventoryHeaders: rows[0] ?? [] });
  } catch (error) {
    return NextResponse.json({ ok: false, configuration: config, googleSheets: 'error', message: error instanceof Error ? error.message : 'Google Sheets connection failed.' }, { status: 500 });
  }
}
