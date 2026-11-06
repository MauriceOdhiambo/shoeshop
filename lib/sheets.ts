import { google } from 'googleapis';

export const INVENTORY_HEADERS = ['ID','Picture','Buying Price','size','Target Price','Status','method Payment','price sold','Profit Margin','comment','Date','Category','Stock Type','Hot Sale','Sale Price','Reserved Date'];
export const ORDER_HEADERS = ['Order ID','Shoe ID','Customer Name','Phone','Location','Comment','Date','Status'];
export const HISTORY_HEADERS = ['Timestamp','Shoe ID','Field Changed','Old Value','New Value','Changed By','Full Row Snapshot','Action'];

function getCredentials(): any {
  const rawValue = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!rawValue) {
    throw new Error('Google Sheets configuration is incomplete: add GOOGLE_SERVICE_ACCOUNT_JSON in Vercel Environment Variables.');
  }
  let raw = rawValue.trim();
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      raw = Buffer.from(raw, 'base64').toString('utf8');
    } else if (raw.startsWith('base64:')) {
      raw = Buffer.from(raw.slice(7), 'base64').toString('utf8');
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('The service-account JSON is missing client_email or private_key.');
    }
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message.includes('missing client_email')) throw error;
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. In Vercel, paste the complete service-account JSON object as one environment-variable value (not the project name or file path).');
  }
}

export function googleAuth(scopes: string[] = ['https://www.googleapis.com/auth/spreadsheets']) {
  return new google.auth.GoogleAuth({ credentials: getCredentials(), scopes });
}

function sheetsClient() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) throw new Error('Google Sheets configuration is incomplete: GOOGLE_SHEETS_SPREADSHEET_ID is missing.');
  const auth = googleAuth(['https://www.googleapis.com/auth/spreadsheets']);
  return google.sheets({ version: 'v4', auth });
}

export async function readRows(tab: string) {
  const api = sheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!.trim();
  try {
    const response = await api.spreadsheets.values.get({ spreadsheetId, range: `'${tab.replace(/'/g, "''")}'!A:Z` });
    return response.data.values ?? [];
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown Google Sheets API error';
    if (/permission|403|forbidden/i.test(detail)) {
      throw new Error(`Google Sheets access denied for tab "${tab}". Share the spreadsheet with the service account client_email as Editor. Details: ${detail}`);
    }
    if (/not found|404/i.test(detail)) throw new Error(`Google spreadsheet or tab "${tab}" was not found. Check the spreadsheet ID and exact tab name. Details: ${detail}`);
    throw new Error(`Could not read Google Sheets tab "${tab}": ${detail}`);
  }
}

export async function appendRow(tab: string, values: unknown[]) {
  const api = sheetsClient();
  await api.spreadsheets.values.append({ spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!.trim(), range: `'${tab.replace(/'/g, "''")}'!A:Z`, valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', requestBody: { values: [values] } });
}
export async function updateRow(tab: string, rowNumber: number, values: unknown[]) {
  const api = sheetsClient();
  await api.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!.trim(), range: `'${tab.replace(/'/g, "''")}'!A${rowNumber}:Z${rowNumber}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [values] } });
}
export async function ensureHistory() {
  const rows = await readRows('History');
  if (!rows.length) await appendRow('History', HISTORY_HEADERS);
}

export function headerColumn(headers: unknown[], names: string[], fallback: number): number {
  const normalized = headers.map((value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
  for (const name of names) {
    const index = normalized.indexOf(name.trim().toLowerCase().replace(/\s+/g, ' '));
    if (index >= 0) return index;
  }
  return fallback;
}

export function driveImageUrl(value: unknown): string {
  const input = String(value ?? '').trim().replace(/&amp;/gi, '&');
  if (!input) return '';
  // Route public Drive images through our own endpoint. This avoids browser hotlink/referrer issues.
  const patterns = [/[?&]id=([a-zA-Z0-9_-]+)/, /\/file\/d\/([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1] && /(^|\.)drive\.google\.com\//i.test(input.replace(/^https?:\/\//, ''))) {
      return `/api/product-image?id=${encodeURIComponent(match[1])}`;
    }
  }
  return input;
}


/** Add the optional inventory columns without disturbing existing inventory data. */
export async function ensureInventoryColumns() {
  const rows = await readRows('Inventory');
  if (!rows.length) return INVENTORY_HEADERS;
  const headers = rows[0].map((value) => String(value ?? '').trim());
  const normalized = headers.map((value) => value.toLowerCase());
  let changed = false;
  for (const header of INVENTORY_HEADERS.slice(13)) {
    if (!normalized.includes(header.toLowerCase())) { headers.push(header); normalized.push(header.toLowerCase()); changed = true; }
  }
  if (changed) await updateRow('Inventory', 1, headers);
  return headers;
}
