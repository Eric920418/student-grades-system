'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  // 登入頁不顯示 Navbar
  if (pathname === '/login') return null;
  // 載入中或未登入不顯示
  if (loading || !user) return null;

  const isAdmin = user.role === 'admin';

  const navLinks = isAdmin
    ? [
        { href: '/', label: '首頁' },
        { href: '/students', label: '學生管理' },
        { href: '/groups', label: '分組管理' },
        { href: '/grade-items', label: '成績項目' },
        { href: '/grades', label: '成績登記' },
      ]
    : [
        { href: '/my-groups', label: '我的分組' },
      ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 mb-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* 左側：系統名稱 */}
          <Link
            href={isAdmin ? '/' : '/my-groups'}
            className="font-bold text-gray-900 text-lg"
          >
            成績管理系統
          </Link>

          {/* 中間：導航連結 */}
          <div className="flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* 右側：用戶資訊 + 登出 */}
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              {user.name || user.studentId}
              <span className={`ml-1 inline-block px-2 py-0.5 text-xs rounded-full ${
                isAdmin
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {isAdmin ? '老師' : '學生'}
              </span>
            </span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              登出
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
