import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// 管理員帳密（寫死）
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

const COOKIE_NAME = 'auth-token';
const JWT_EXPIRY = '7d';

export interface UserPayload {
  role: 'admin' | 'student';
  studentId?: string;
  name?: string;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET 環境變數未設定');
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: UserPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(JWT_EXPIRY)
    .setIssuedAt()
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<UserPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function validateAdmin(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function getTokenCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 天
  };
}

/**
 * API route 用：從 request headers 中取得用戶資訊（由 middleware 注入）
 */
export function getUserFromHeaders(request: NextRequest): UserPayload | null {
  const role = request.headers.get('x-user-role');
  if (!role) return null;
  return {
    role: role as 'admin' | 'student',
    studentId: request.headers.get('x-user-student-id') || undefined,
    name: request.headers.get('x-user-name') || undefined,
  };
}

/**
 * API route 用：檢查是否為管理員，不是的話回傳 403 Response
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const user = getUserFromHeaders(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json(
      { error: '需要管理員權限' },
      { status: 403 }
    );
  }
  return null; // 通過
}
