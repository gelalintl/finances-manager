import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/cn'

type ButtonVariant = 'solid' | 'outline' | 'secondary' | 'ghost' | 'danger' | 'income'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
}

const variantClass: Record<ButtonVariant, string> = {
  solid: 'bg-primary text-white border border-transparent hover:bg-primary-hover',
  outline: 'bg-transparent text-primary border border-primary hover:bg-primary/5',
  secondary: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15',
  ghost: 'bg-transparent text-foreground-muted border border-transparent hover:bg-foreground/5',
  danger: 'bg-danger text-white border border-transparent hover:bg-danger/80',
  income: 'bg-income text-white border border-transparent hover:bg-income/80',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

export function Button({
  variant = 'solid',
  size = 'md',
  isLoading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-sans font-bold',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-60',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {isLoading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  )
}
