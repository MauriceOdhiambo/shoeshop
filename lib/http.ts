import { NextResponse } from 'next/server';
export const badRequest = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });
export const unauthorized = () => badRequest('Please sign in as an administrator.', 401);
