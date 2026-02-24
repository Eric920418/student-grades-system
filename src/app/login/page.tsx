'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type LoginType = 'student' | 'admin';
type PageMode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const [pageMode, setPageMode] = useState<PageMode>('login');
  const [loginType, setLoginType] = useState<LoginType>('student');
  const [studentId, setStudentId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 註冊用
  const [regStudentId, setRegStudentId] = useState('');
  const [regName, setRegName] = useState('');
  const [regClass, setRegClass] = useState<'A' | 'B'>('A');

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: regStudentId,
          name: regName,
          class: regClass,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '註冊失敗');
      }

      router.push('/my-groups');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '註冊失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">學生成績管理系統</h1>
          <p className="text-gray-600 mt-2">
            {pageMode === 'login' ? '請選擇身份登入' : '學生註冊'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* 錯誤訊息 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {pageMode === 'login' ? (
            <>
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
                  管理員登入
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {loginType === 'student' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      學號
                    </label>
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="請輸入學號"
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        帳號
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="請輸入管理員帳號"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        密碼
                      </label>
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
                <div className="mt-4 text-center">
                  <button
                    onClick={() => {
                      setPageMode('register');
                      setError('');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    首次使用？點此註冊
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* 註冊表單 */}
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    學號
                  </label>
                  <input
                    type="text"
                    value={regStudentId}
                    onChange={(e) => setRegStudentId(e.target.value)}
                    placeholder="請輸入學號"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓名
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="請輸入姓名"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    班級
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="class"
                        value="A"
                        checked={regClass === 'A'}
                        onChange={() => setRegClass('A')}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-gray-700">A班</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="class"
                        value="B"
                        checked={regClass === 'B'}
                        onChange={() => setRegClass('B')}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-gray-700">B班</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors font-medium"
                >
                  {loading ? '註冊中...' : '註冊'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setPageMode('login');
                    setError('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  已有帳號？返回登入
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
