import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { auth } from '../../lib/auth';
import { useSession } from '../../lib/session';

interface LoginForm {
  email: string;
  password: string;
}

/** 登录页（独立于 AppShell）。 */
export function Component() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useSession();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();

  const redirectTo = safeRedirect(searchParams.get('redirectTo'));

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  const onSubmit = async (values: LoginForm) => {
    setSubmitError(null);
    try {
      await auth.login(values);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '登录失败，请稍后重试');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400 text-xl font-bold text-slate-900">
            H
          </span>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-slate-900">登录 Helio</h1>
            <p className="mt-1 text-sm text-slate-500">太阳能能源监控平台</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">邮箱</label>
            <input
              type="email"
              placeholder="admin@helio.dev"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200"
              {...register('email', { required: '请输入邮箱' })}
            />
            {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">密码</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200"
              {...register('password', { required: '请输入密码' })}
            />
            {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-yellow-300"
          >
            {isSubmitting ? '登录中...' : '登录'}
          </button>
        </form>

        {submitError && (
          <p className="mt-4 text-center text-xs text-rose-600">{submitError}</p>
        )}
      </div>
    </div>
  );
}

function safeRedirect(value: string | null): string {
  if (value?.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return '/dashboard';
}
