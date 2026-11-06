import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!await requireAdmin(['Super Admin', 'Admin'])) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: 'Choose a shoe photo first.' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ success: false, message: 'Only image files can be uploaded.' }, { status: 400 });
    // Vercel serverless requests have a small body-size ceiling; keep the upload comfortably below it.
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ success: false, message: 'Photo must be 4 MB or smaller.' }, { status: 413 });

    const endpoint = process.env.GOOGLE_DRIVE_UPLOAD_WEB_APP_URL?.trim();
    const token = process.env.GOOGLE_DRIVE_UPLOAD_TOKEN?.trim();
    if (!endpoint || !token) return NextResponse.json({ success: false, message: 'Google Drive photo upload is not configured yet. Add GOOGLE_DRIVE_UPLOAD_WEB_APP_URL and GOOGLE_DRIVE_UPLOAD_TOKEN in Vercel, then redeploy. Follow docs/DRIVE-UPLOAD-SETUP.md.' }, { status: 500 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'follow', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, fileName: file.name, mimeType: file.type, base64: bytes.toString('base64') }),
    });
    const raw = await response.text();
    let result: any;
    try { result = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error(`Google Drive upload service returned an unexpected response (HTTP ${response.status}). Check the Apps Script deployment URL.`); }
    if (!response.ok || !result.success || !result.picture) throw new Error(result.message || `Google Drive upload failed (HTTP ${response.status}).`);
    return NextResponse.json({ success: true, picture: result.picture, fileId: result.fileId, name: result.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Photo upload failed.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
