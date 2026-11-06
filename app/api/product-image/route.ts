import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || '';
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(id)) return new NextResponse('Invalid Google Drive image ID.', { status: 400 });
  try {
    const upstream = await fetch(`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 ShoeStudioImageProxy/1.0' },
      cache: 'no-store',
    });
    if (!upstream.ok) return new NextResponse(`Google Drive image request failed (${upstream.status}). Check that the file is shared as Anyone with the link – Viewer.`, { status: 502 });
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) return new NextResponse('Google Drive did not return an image. Check the file sharing permission and image file.', { status: 502 });
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return new NextResponse(error instanceof Error ? `Image proxy error: ${error.message}` : 'Image could not be loaded from Google Drive.', { status: 502 });
  }
}
