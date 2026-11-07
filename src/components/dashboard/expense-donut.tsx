import { PieChart } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { CategoryIcon } from '@/components/ui/category-icon'
import { Caption, Heading, Text } from '@/components/ui/typography'
import type { CategorySlice } from '@/lib/analytics'
import { formatMoney, formatPercent } from '@/lib/money'
import { cn } from '@/lib/cn'

type ExpenseDonutProps = {
  slices: CategorySlice[]
  total: number
  currency: string
  className?: string
  /** Nombre de catégories détaillées avant regroupement en « Autres ». */
  maxSlices?: number
}

export function ExpenseDonut({
  slices,
  total,
  currency,
  className,
  maxSlices = 6,
}: ExpenseDonutProps) {
  // Au-delà de `maxSlices`, on agrège la traîne pour garder l'anneau lisible.
  const head = slices.slice(0, maxSlices)
  const tail = slices.slice(maxSlices)
  const tailAmount = tail.reduce((sum, slice) => sum + slice.amount, 0)

  const display: CategorySlice[] =
    tailAmount > 0
      ? [
          ...head,
          {
            publicId: '__others__',
            name: `Autres (${tail.length})`,
            color: '#94a3b8',
            icon: 'Wallet',
            amount: tailAmount,
            share: total > 0 ? (tailAmount / total) * 100 : 0,
          },
        ]
      : head

  const radius = 60
  const stroke = 22
  const circumference = 2 * Math.PI * radius
  const safeTotal = Math.max(total, 1)

  // Décalages cumulés calculés en amont : chaque arc démarre là où le précédent s'arrête.
  const segments = display.reduce<Array<CategorySlice & { length: number; offset: number }>>(
    (acc, slice) => {
      const previous = acc[acc.length - 1]
      return [
        ...acc,
        {
          ...slice,
          length: (slice.amount / safeTotal) * circumference,
          offset: previous ? previous.offset + previous.length : 0,
        },
      ]
    },
    [],
  )

  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-5">
        <Heading as="h3" size="md" weight="bold" className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary" />
          Répartition des dépenses
        </Heading>
        <Caption className="mt-0.5 block">Mois en cours, par catégorie</Caption>
      </div>

      {total <= 0 ? (
        <Text variant="muted" size="sm">
          Aucune dépense enregistrée ce mois-ci.
        </Text>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <svg
              viewBox="0 0 160 160"
              className="h-40 w-40 -rotate-90"
              role="img"
              aria-label="Répartition des dépenses par catégorie"
            >
              <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-foreground/5" />
              {segments.map((segment) => (
                <circle
                  key={segment.publicId}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                  strokeDashoffset={-segment.offset}
                  strokeLinecap="butt"
                >
                  <title>{`${segment.name} — ${formatMoney(segment.amount, currency)}`}</title>
                </circle>
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Caption weight="bold" className="tracking-wide uppercase">
                Total
              </Caption>
              <p className="max-w-[7rem] truncate text-center text-sm font-bold text-foreground">
                {formatMoney(total, currency)}
              </p>
            </div>
          </div>

          <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
            {display.map((slice) => (
              <li key={slice.publicId} className="flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${slice.color}1f`, color: slice.color }}
                >
                  <CategoryIcon icon={slice.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {slice.name}
                </span>
                <span className="shrink-0 text-sm font-bold text-foreground">
                  {formatMoney(slice.amount, currency)}
                </span>
                <span className="w-12 shrink-0 text-right text-xs font-bold text-foreground-muted">
                  {formatPercent(slice.share)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
