import type { ReactNode } from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/card'
import { Caption, Heading } from '@/components/ui/typography'
import { formatPercent } from '@/lib/money'
import { cn } from '@/lib/cn'

type StatsTone = 'default' | 'income' | 'expense' | 'warning'

const toneClass: Record<StatsTone, string> = {
  default: 'bg-primary/10 text-primary',
  income: 'bg-income/10 text-income',
  expense: 'bg-expense/10 text-expense',
  warning: 'bg-warning/10 text-warning',
}

type StatsCardProps = {
  title: string
  value: string
  hint?: ReactNode
  icon?: ReactNode
  tone?: StatsTone
  className?: string
  children?: ReactNode
}

export function StatsCard({
  title,
  value,
  hint,
  icon,
  tone = 'default',
  className,
  children,
}: StatsCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <CardBody className="flex items-start gap-4">
        {icon ? (
          <span
            className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', toneClass[tone])}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <Caption weight="bold" className="tracking-wide uppercase">
            {title}
          </Caption>
          <Heading as="h3" className="mt-1 truncate text-2xl">
            {value}
          </Heading>
          {hint ? <div className="mt-1 text-sm text-foreground-muted">{hint}</div> : null}
          {children}
        </div>
      </CardBody>
    </Card>
  )
}

/**
 * Badge d'évolution entre deux périodes.
 * `invert` : pour les dépenses, une hausse est une mauvaise nouvelle.
 */
export function EvolutionBadge({
  value,
  invert = false,
  label,
}: {
  value: number | null
  invert?: boolean
  label?: string
}) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground-muted">
        <Minus className="h-3.5 w-3.5" />
        {label ? <span className="font-medium">{label}</span> : 'Pas de référence'}
      </span>
    )
  }

  const positive = value > 0
  const neutral = value === 0
  const good = neutral ? true : invert ? !positive : positive
  const Icon = neutral ? Minus : positive ? TrendingUp : TrendingDown

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-bold',
        neutral ? 'text-foreground-muted' : good ? 'text-income' : 'text-expense',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {positive ? '+' : ''}
      {formatPercent(value, Math.abs(value) < 10 && !Number.isInteger(value) ? 1 : 0)}
      {label ? <span className="font-medium text-foreground-muted">{label}</span> : null}
    </span>
  )
}
