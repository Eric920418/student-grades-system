import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'auth-token';

// 公開路由（不需要登入）
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/register'];

// 管理員專用頁面
const ADMIN_ONLY_PAGES = ['/students', '/grade-items', '/grades', '/groups'];

// 學生分組 API（學生也能用）
const STUDENT_API_PATHS = ['/api/student/', '/api/auth/'];

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET 環境變數未設定');
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 靜態資源和 _next 路由直接放行
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 公開路由放行
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // 讀取 token
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    // 未登入 → 導向登入頁
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 驗證 token
  let payload: { role: string; studentId?: string; name?: string };
  try {
    const result = await jwtVerify(token, getJwtSecret());
    payload = result.payload as typeof payload;
  } catch {
    // token 無效 → 清除 cookie 並導向登入頁
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '登入已過期，請重新登入' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // 學生嘗試訪問管理員頁面 → redirect 到 /my-groups
  if (payload.role === 'student') {
    // 檢查頁面路由
    if (ADMIN_ONLY_PAGES.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/my-groups', request.url));
    }
    // 首頁也 redirect
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/my-groups', request.url));
    }
    // 檢查 API 路由的寫入操作（POST/PUT/DELETE）
    if (pathname.startsWith('/api/') && !STUDENT_API_PATHS.some(p => pathname.startsWith(p))) {
      const method = request.method;
      if (method !== 'GET') {
        return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
      }
    }
  }

  // 注入 headers 供 API route 使用
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-role', payload.role);
  if (payload.studentId) requestHeaders.set('x-user-student-id', payload.studentId);
  if (payload.name) requestHeaders.set('x-user-name', payload.name);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
