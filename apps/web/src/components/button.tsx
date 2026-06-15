import type { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-yellow-400 text-slate-900 hover:bg-yellow-300',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

/** 通用按钮。 */
export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
