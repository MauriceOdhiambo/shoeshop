import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readRows } from '@/lib/sheets';

const COOKIE = 'shoeshop_admin';
const SCRYPT_KEY_LENGTH = 64;
export type AdminRole = 'Super Admin' | 'Admin';
export type AdminIdentity = { username: string; role: AdminRole };

type AdminRecord = { username: string; passwordHash: string; salt: string; role: AdminRole; active: boolean; rowNumber: number };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  return new TextEncoder().encode(value);
}

function parseActive(value: unknown) {
  return ['true', '1', 'yes', 'active'].includes(String(value ?? '').trim().toLowerCase());
}

async function getAdminRecords(): Promise<AdminRecord[]> {
  const rows = await readRows('Admins');
  if (!rows.length) return [];
  const headers = rows[0].map((v) => String(v).trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name.toLowerCase());
  const usernameCol = col('username');
  const hashCol = col('passwordhash');
  const saltCol = col('salt');
  const roleCol = col('role');
  const activeCol = col('active');
  if ([usernameCol, hashCol, saltCol, roleCol, activeCol].some((i) => i < 0)) {
    throw new Error('Admins sheet needs these headers: Username, PasswordHash, Salt, Role, Active. Run npm run admins:setup.');
  }
  return rows.slice(1).map((r, i) => {
    const rawRole = String(r[roleCol] ?? 'Admin').trim();
    const role: AdminRole = rawRole === 'Super Admin' ? 'Super Admin' : 'Admin';
    return {
      username: String(r[usernameCol] ?? '').trim(),
      passwordHash: String(r[hashCol] ?? '').trim().toLowerCase(),
      salt: String(r[saltCol] ?? '').trim(),
      role,
      active: parseActive(r[activeCol]),
      rowNumber: i + 2,
    };
  }).filter((a) => a.username);
}

export async function verifyAdmin(username: string, password: string): Promise<AdminIdentity | null> {
  const normalized = username.trim().toLowerCase();
  if (!normalized || !password || password.length > 256) return null;
  const admins = await getAdminRecords();
  const admin = admins.find((a) => a.username.toLowerCase() === normalized);
  // Do a dummy scrypt for unknown users to reduce username-enumeration timing differences.
  if (!admin || !admin.active || !/^[a-f0-9]{128}$/.test(admin.passwordHash) || !/^[a-f0-9]{32,128}$/i.test(admin.salt)) {
    scryptSync(password, 'shoeshop-invalid-user-dummy-salt', SCRYPT_KEY_LENGTH);
    return null;
  }
  const actual = scryptSync(password, admin.salt, SCRYPT_KEY_LENGTH);
  const expected = Buffer.from(admin.passwordHash, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { username: admin.username, role: admin.role };
}

export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 256) throw new Error('Password must be between 12 and 256 characters.');
  const salt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return { salt, passwordHash };
}

export async function createSession(username: string) {
  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Re-check the Admins sheet on every protected request so disabled or changed accounts lose access immediately. */
export async function getAdmin(): Promise<AdminIdentity | null> {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    const sessionUsername = payload.username;
    if (typeof sessionUsername !== 'string') return null;
    const admin = (await getAdminRecords()).find((a) => a.username.toLowerCase() === sessionUsername.toLowerCase());
    if (!admin || !admin.active) return null;
    return { username: admin.username, role: admin.role };
  } catch {
    return null;
  }
}

export async function requireAdmin(allowedRoles: AdminRole[] = ['Super Admin', 'Admin']) {
  const admin = await getAdmin();
  if (!admin || !allowedRoles.includes(admin.role)) return null;
  return admin;
}
