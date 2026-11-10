import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Caption } from '@/components/ui/typography'

export const controlClass =
  'w-full min-h-10 rounded-xl border border-subtle-border bg-surface px-3 py-2 font-sans text-sm font-medium text-foreground placeholder:font-normal placeholder:text-foreground-muted/70 transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-background disabled:opacity-70'

export const labelClass = 'mb-1.5 block font-sans text-xs font-bold tracking-wide text-foreground-muted uppercase'

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  ref?: Ref<HTMLInputElement>
  label: string
  error?: string
  trailing?: ReactNode
  hint?: string
}

export function InputField({
  id,
  label,
  error,
  trailing,
  hint,
  className,
  disabled,
  ...props
}: InputFieldProps) {
  const fieldId = id ?? props.name
  const errorId = error && fieldId ? `${fieldId}-error` : undefined

  return (
    <div className="flex flex-col">
      <label htmlFor={fieldId} className={labelClass}>
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={fieldId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            controlClass,
            error ? 'border-danger focus:border-danger focus:ring-danger/30' : undefined,
            trailing ? 'pr-10' : undefined,
            className,
          )}
          {...props}
        />
        {trailing ? (
          <div className="absolute right-3 flex items-center text-foreground-muted">{trailing}</div>
        ) : null}
      </div>
      {error ? (
        <Caption id={errorId} color="danger" className="mt-1 font-medium">
          {error}
        </Caption>
      ) : hint ? (
        <Caption className="mt-1">{hint}</Caption>
      ) : null}
    </div>
  )
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  error?: string
}

export function SelectField({ id, label, error, className, children, ...props }: SelectFieldProps) {
  const fieldId = id ?? props.name

  return (
    <div className="flex flex-col">
      <label htmlFor={fieldId} className={labelClass}>
        {label}
      </label>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(controlClass, 'cursor-pointer', error ? 'border-danger' : undefined, className)}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <Caption color="danger" className="mt-1 font-medium">
          {error}
        </Caption>
      ) : null}
    </div>
  )
}
