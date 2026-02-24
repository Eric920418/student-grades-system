'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // 路由切換時自動關閉選單
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
    <nav className="bg-white shadow-sm border-b border-gray-200 mb-4 md:mb-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* 左側：系統名稱 */}
          <Link
            href={isAdmin ? '/' : '/my-groups'}
            className="font-bold text-gray-900 text-lg"
          >
            成績管理系統
          </Link>

          {/* 桌面版：中間導航連結 */}
          <div className="hidden md:flex items-center space-x-1">
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

          {/* 桌面版：右側用戶資訊 + 登出 */}
          <div className="hidden md:flex items-center space-x-3">
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

          {/* 手機版：Hamburger 按鈕 */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="切換選單"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* 手機版：展開選單 */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 py-3 space-y-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="border-t border-gray-200 mt-2 pt-2 px-3 flex items-center justify-between">
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
                className="text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                登出
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
