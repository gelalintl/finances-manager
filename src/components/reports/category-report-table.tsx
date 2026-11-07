import { Card } from '@/components/ui/card'
import { EvolutionBadge } from '@/components/dashboard/stats-card'
import { CategoryBadge } from '@/components/ui/category-icon'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { formatMoney, formatPercent } from '@/lib/money'
import type { CategoryReportRow } from '@/lib/reports'
import { cn } from '@/lib/cn'

type CategoryReportTableProps = {
  rows: CategoryReportRow[]
  currency: string
  comparisonLabel: string
  budgetScopeLabel: string
}

export function CategoryReportTable({
  rows,
  currency,
  comparisonLabel,
  budgetScopeLabel,
}: CategoryReportTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-subtle-border px-5 py-4">
        <Heading as="h2" size="lg">
          Dépenses par catégorie
        </Heading>
        <Caption className="mt-1 block">
          {budgetScopeLabel}. L&apos;écart compare la dépense réelle au plafond. La variation est {comparisonLabel}.
        </Caption>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Text weight="bold">Aucune dépense sur cette période</Text>
          <Caption className="mt-1 block">Les catégories plafonnées apparaîtront ici même à zéro.</Caption>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left">
            <thead className="border-b border-subtle-border bg-background/60">
              <tr>
                <th className="px-4 py-3 text-xs font-bold tracking-wide text-foreground-muted uppercase">
                  Catégorie
                </th>
                <th className="px-4 py-3 text-xs font-bold tracking-wide text-foreground-muted uppercase">
                  Plafond budget
                </th>
                <th className="px-4 py-3 text-xs font-bold tracking-wide text-foreground-muted uppercase">
                  Dépense réelle
                </th>
                <th className="px-4 py-3 text-xs font-bold tracking-wide text-foreground-muted uppercase">
                  Écart
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold tracking-wide text-foreground-muted uppercase">
                  % du total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.publicId ?? 'uncategorized'} className="border-b border-subtle-border last:border-0">
                  <td className="px-4 py-3">
                    <CategoryBadge name={row.name} icon={row.icon} color={row.color} />
                    <div className="mt-1">
                      <EvolutionBadge value={row.variation} invert label={comparisonLabel} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {row.budgetLimit === null ? (
                      <span className="text-foreground-muted">Sans plafond</span>
                    ) : (
                      formatMoney(row.budgetLimit, currency)
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold">{formatMoney(row.spent, currency)}</td>
                  <td className="px-4 py-3 text-sm">
                    {row.gap === null ? (
                      <span className="text-foreground-muted">—</span>
                    ) : (
                      <span className={cn('font-bold', row.gap >= 0 ? 'text-income' : 'text-expense')}>
                        {row.gap >= 0 ? 'Économie' : 'Dépassement'} {formatMoney(Math.abs(row.gap), currency)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold">
                    {formatPercent(row.share, Number.isInteger(row.share) ? 0 : 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
