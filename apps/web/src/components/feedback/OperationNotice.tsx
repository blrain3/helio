import { CheckCircle2, CircleAlert } from 'lucide-react';

interface OperationNoticeProps {
  tone: 'success' | 'error';
  children: string;
}

export function OperationNotice({ tone, children }: OperationNoticeProps) {
  const isSuccess = tone === 'success';

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      className={
        isSuccess
          ? 'mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
          : 'mb-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800'
      }
    >
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  );
}
