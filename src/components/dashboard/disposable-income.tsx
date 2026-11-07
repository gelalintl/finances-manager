import { Scale } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Caption, Heading, Text } from '@/components/ui/typography'
import type { DisposableIncome } from '@/lib/budget'
import { formatMoney, formatPercent } from '@/lib/money'
import { cn } from '@/lib/cn'

type DisposableIncomeCardProps = {
  data: DisposableIncome
  currency: string
  className?: string
}

/**
 * Détail du Reste à Vivre :
 * Revenus − Charges fixes (récurrentes) − Dépenses variables.
 */
export function DisposableIncomeCard({ data, currency, className }: DisposableIncomeCardProps) {
  const rows = [
    { label: 'Revenus du mois', value: data.income, tone: 'text-income', sign: '+' },
    { label: 'Charges fixes', value: data.fixedCharges, tone: 'text-expense', sign: '\u2212' },
    { label: 'Dépenses variables', value: data.variableExpenses, tone: 'text-expense', sign: '\u2212' },
  ]

  // Largeurs de la barre de composition, proportionnelles au revenu.
  const base = Math.max(data.income, data.totalExpenses, 1)
  const fixedWidth = (data.fixedCharges / base) * 100
  const variableWidth = (data.variableExpenses / base) * 100
  const disposableWidth = Math.max(0, (Math.max(data.disposable, 0) / base) * 100)

  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-5">
        <Heading as="h3" size="md" weight="bold" className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          Reste à vivre
        </Heading>
        <Caption className="mt-0.5 block">Revenus − charges fixes − dépenses variables</Caption>
      </div>

      <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full bg-foreground/8">
        <div className="h-full bg-expense/100" style={{ width: `${fixedWidth}%` }} title="Charges fixes" />
        <div className="h-full bg-warning" style={{ width: `${variableWidth}%` }} title="Dépenses variables" />
        <div className="h-full bg-income/100" style={{ width: `${disposableWidth}%` }} title="Reste à vivre" />
      </div>

      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-foreground-muted">{row.label}</span>
            <span className={cn('shrink-0 font-bold', row.tone)}>
              {row.sign}
              {formatMoney(row.value, currency)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-subtle-border pt-4">
        <div className="min-w-0">
          <Caption weight="bold" className="tracking-wide uppercase">
            Disponible
          </Caption>
          <Text
            size="xl"
            weight="bold"
            className={cn('truncate', data.disposable < 0 ? 'text-expense' : 'text-income')}
          >
            {formatMoney(data.disposable, currency)}
          </Text>
        </div>
        <Caption className="shrink-0 text-right">
          {data.disposable < 0 ? 'Budget dépassé' : `${formatPercent(data.savingsRate)} du revenu`}
        </Caption>
      </div>
    </Card>
  )
}
