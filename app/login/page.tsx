/**
 * 登录页面
 *
 * 用户点击"使用飞书登录"按钮后，会跳转到飞书OAuth授权页面
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 检查是否有错误参数
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(errorParam);
    }
  }, [searchParams]);

  const handleLogin = () => {
    try {
      setIsLoading(true);

      // 生成随机state用于CSRF防护
      const state = Math.random().toString(36).substring(7);

      // 保存state到sessionStorage（在回调时验证）
      sessionStorage.setItem('oauth_state', state);

      // 构建OAuth授权URL
      const oauthUrl = `/api/auth/feishu/authorize?state=${state}`;

      // 跳转到授权页面
      window.location.href = oauthUrl;
    } catch (err) {
      setError('登录失败，请重试');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
        {/* Logo和标题 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            人力占用记录系统
          </h1>
          <p className="text-gray-600">
            使用飞书账号登录
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* 登录按钮 */}
        <div className="mt-8">
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                正在跳转...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                </svg>
                使用飞书登录
              </>
            )}
          </button>
        </div>

        {/* 说明文字 */}
        <div className="text-center text-sm text-gray-500 mt-4">
          <p>
            登录即表示您同意使用飞书账号进行身份验证
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
