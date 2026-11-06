import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { google } from 'googleapis';
import { randomBytes, scryptSync } from 'node:crypto';
import readline from 'node:readline';

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.error('Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON in .env.local first.');
  process.exit(1);
}

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const api = google.sheets({ version: 'v4', auth });

function askVisible(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

function askHidden(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return askVisible(`${question} (input will be visible in this non-interactive terminal): `);
  }
  process.stdout.write(`${question} (input hidden): `);
  const stdin = process.stdin;
  const previousRawMode = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  let value = '';
  return new Promise((resolve) => {
    const onData = (chunk) => {
      const key = chunk.toString('utf8');
      if (key === '\u0003') {
        cleanup();
        process.exit(130);
      }
      if (key === '\r' || key === '\n') {
        cleanup();
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (key === '\u007f' || key === '\b') value = value.slice(0, -1);
      else if (key >= ' ' && key <= '~') value += key;
    };
    function cleanup() {
      stdin.removeListener('data', onData);
      stdin.setRawMode(Boolean(previousRawMode));
    }
    stdin.on('data', onData);
  });
}

try {
  const meta = await api.spreadsheets.get({ spreadsheetId });
  const hasAdmins = (meta.data.sheets ?? []).some((sheet) => sheet.properties?.title === 'Admins');
  if (!hasAdmins) {
    await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: 'Admins' } } }] } });
  }

  console.log('\nThis setup replaces the contents of the Admins tab with three secure administrator records.');
  console.log('It does NOT read or reuse the old plain-text passwords. Choose new passwords of at least 12 characters.\n');
  const confirmation = String(await askVisible('Type REPLACE ADMINS to continue: ')).trim();
  if (confirmation !== 'REPLACE ADMINS') {
    console.log('Cancelled. No changes made.');
  } else {
    const accounts = [
      { username: 'morisky', role: 'Super Admin' },
      { username: 'mon', role: 'Admin' },
      { username: 'kamala', role: 'Admin' },
    ];
    const values = [['Username', 'PasswordHash', 'Salt', 'Role', 'Active']];
    for (const account of accounts) {
      let password = '';
      while (password.length < 12 || password.length > 256) {
        password = await askHidden(`Enter a NEW password for ${account.username} (12–256 characters)`);
        if (password.length < 12 || password.length > 256) console.log('Password must be between 12 and 256 characters. Try again.');
      }
      const salt = randomBytes(16).toString('hex');
      const passwordHash = scryptSync(password, salt, 64).toString('hex');
      values.push([account.username, passwordHash, salt, account.role, 'TRUE']);
      password = '';
    }
    await api.spreadsheets.values.clear({ spreadsheetId, range: 'Admins!A:Z' });
    await api.spreadsheets.values.update({ spreadsheetId, range: 'Admins!A1', valueInputOption: 'RAW', requestBody: { values } });
    console.log('\nAdmins tab updated successfully. Passwords were hashed before being written to Google Sheets.');
    console.log('Morisky: Super Admin | Mon: Admin | Kamala: Admin');
  }
} catch (error) {
  console.error('Admin setup failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
