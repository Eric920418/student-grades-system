'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type LoginType = 'student' | 'admin';

export default function LoginPage() {
  const router = useRouter();
  const [loginType, setLoginType] = useState<LoginType>('student');
  const [studentId, setStudentId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body =
        loginType === 'student'
          ? { type: 'student', studentId }
          : { type: 'admin', username, password };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '登入失敗');
      }

      if (data.user.role === 'admin') {
        router.push('/');
      } else {
        router.push('/my-groups');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">學生成績管理系統</h1>
          <p className="text-gray-600 mt-2">請選擇身份登入</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          {/* 錯誤訊息 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Tab 切換 */}
          <div className="flex mb-6 border-b border-gray-200">
            <button
              onClick={() => {
                setLoginType('student');
                setError('');
              }}
              className={`flex-1 pb-3 text-center font-medium transition-colors ${
                loginType === 'student'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              學生登入
            </button>
            <button
              onClick={() => {
                setLoginType('admin');
                setError('');
              }}
              className={`flex-1 pb-3 text-center font-medium transition-colors ${
                loginType === 'admin'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              老師登入
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginType === 'student' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">學號</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="請輸入學號 不用加s"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  密碼與學號相同，直接輸入學號即可登入
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">帳號</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="請輸入老師帳號"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="請輸入密碼"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors font-medium"
            >
              {loading ? '登入中...' : '登入'}
            </button>
          </form>

          {loginType === 'student' && (
            <p className="mt-4 text-center text-xs text-gray-500">
              學生名單由老師從校務系統匯入。若無法登入，請聯絡授課老師。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
