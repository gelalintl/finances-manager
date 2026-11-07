import { AlertTriangle, Target } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { CategoryBadge } from '@/components/ui/category-icon'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { budgetToneClasses, type BudgetGauge } from '@/lib/budget'
import { formatMoney, formatPercent } from '@/lib/money'
import { cn } from '@/lib/cn'

type BudgetGaugesProps = {
  gauges: BudgetGauge[]
  currency: string
  className?: string
}

export function BudgetGauges({ gauges, currency, className }: BudgetGaugesProps) {
  const exceeded = gauges.filter((gauge) => gauge.exceeded).length

  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading as="h3" size="md" weight="bold" className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Jauges de budget
          </Heading>
          <Caption className="mt-0.5 block">Consommation du mois par catégorie</Caption>
        </div>
        {exceeded > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-expense/10 px-2.5 py-1 text-xs font-bold text-expense">
            <AlertTriangle className="h-3.5 w-3.5" />
            {exceeded} dépassement{exceeded > 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {gauges.length === 0 ? (
        <Text variant="muted" size="sm">
          Aucune catégorie plafonnée. Définissez un plafond mensuel pour suivre vos budgets.
        </Text>
      ) : (
        <ul className="flex flex-col gap-4">
          {gauges.map((gauge) => {
            const tone = budgetToneClasses[gauge.tone]

            return (
              <li key={gauge.categoryPublicId}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <CategoryBadge name={gauge.name} icon={gauge.icon} color={gauge.color} />
                  <span className={cn('shrink-0 text-xs font-bold', tone.text)}>
                    {formatPercent(gauge.ratio)}
                  </span>
                </div>

                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-foreground/8"
                  role="progressbar"
                  aria-valuenow={Math.round(gauge.ratio)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Budget ${gauge.name}`}
                >
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', tone.bar)}
                    style={{ width: `${gauge.width}%` }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <Caption>
                    {formatMoney(gauge.spent, currency)} / {formatMoney(gauge.limit, currency)}
                  </Caption>
                  <Caption className={gauge.exceeded ? 'font-bold text-expense' : undefined}>
                    {gauge.exceeded
                      ? `Dépassé de ${formatMoney(Math.abs(gauge.remaining), currency)}`
                      : `Reste ${formatMoney(gauge.remaining, currency)}`}
                  </Caption>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
