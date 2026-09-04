import type { ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../button';
import { LoadingState } from '../ui';

interface QueryFeedbackProps {
  children: ReactNode;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

export function QueryFeedback({
  children,
  isLoading = false,
  error,
  onRetry,
}: QueryFeedbackProps) {
  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    const message = error instanceof Error ? error.message : '请求未能完成，请稍后重试';

    return (
      <section
        role="alert"
        className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-md border border-rose-200 bg-rose-50 px-6 py-8 text-center"
      >
        <AlertCircle className="h-5 w-5 text-rose-600" aria-hidden="true" />
        <p className="text-sm text-rose-800">{message}</p>
        {onRetry && (
          <Button type="button" variant="secondary" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            重试
          </Button>
        )}
      </section>
    );
  }

  return <>{children}</>;
}
