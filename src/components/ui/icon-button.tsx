import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  tone?: 'default' | 'danger'
  children: ReactNode
}

export function IconButton({ label, tone = 'default', className, children, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={cn(
        'group relative inline-flex items-center justify-center rounded-lg p-2 transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40',
        tone === 'danger'
          ? 'text-expense hover:bg-expense/10'
          : 'text-foreground-muted hover:bg-foreground/5 hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-[11px] font-bold whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {label}
      </span>
    </button>
  )
}
