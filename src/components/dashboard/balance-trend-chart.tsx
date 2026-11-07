import { Activity } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Caption, Heading, Text } from '@/components/ui/typography'
import type { MonthPoint } from '@/lib/analytics'
import { formatCompact, formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'

type BalanceTrendChartProps = {
  points: MonthPoint[]
  currency: string
  className?: string
}

/**
 * Graphique combiné en SVG pur (pas de dépendance de charting) :
 *  - barres groupées revenus / dépenses, sur une échelle commune ;
 *  - courbe du solde cumulé, sur sa propre échelle (annotée en légende).
 */
export function BalanceTrendChart({ points, currency, className }: BalanceTrendChartProps) {
  const width = 680
  const height = 240
  const pad = { top: 16, right: 16, bottom: 30, left: 16 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const flowMax = Math.max(...points.flatMap((point) => [point.income, point.expense]), 1)

  const balances = points.map((point) => point.balance)
  const balanceMin = Math.min(...balances, 0)
  const balanceMax = Math.max(...balances, 1)
  const balanceSpan = balanceMax - balanceMin || 1

  const groupW = innerW / Math.max(points.length, 1)
  const barW = Math.max(8, groupW * 0.26)

  const isEmpty = points.every((point) => point.income === 0 && point.expense === 0)

  function balanceY(value: number) {
    return pad.top + innerH - ((value - balanceMin) / balanceSpan) * innerH
  }

  const linePoints = points
    .map((point, index) => `${pad.left + index * groupW + groupW / 2},${balanceY(point.balance)}`)
    .join(' ')

  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Heading as="h3" size="md" weight="bold" className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Évolution sur 6 mois
          </Heading>
          <Caption className="mt-0.5 block">Revenus, dépenses et solde cumulé</Caption>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-bold">
          <span className="flex items-center gap-1.5 text-income">
            <span className="h-2 w-2 rounded-full bg-income/100" /> Revenus
          </span>
          <span className="flex items-center gap-1.5 text-expense">
            <span className="h-2 w-2 rounded-full bg-expense/100" /> Dépenses
          </span>
          <span className="flex items-center gap-1.5 text-primary">
            <span className="h-2 w-4 rounded-full bg-primary" /> Solde
          </span>
        </div>
      </div>

      {isEmpty ? (
        <Text variant="muted" size="sm">
          Pas encore d&apos;historique sur cette période.
        </Text>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-60 w-full"
            role="img"
            aria-label="Évolution des revenus, dépenses et du solde sur six mois"
          >
            {/* Lignes de repère */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1={pad.left}
                x2={width - pad.right}
                y1={pad.top + innerH * ratio}
                y2={pad.top + innerH * ratio}
                stroke="currentColor"
                strokeWidth="1"
                className="text-foreground/6"
              />
            ))}

            {points.map((point, index) => {
              const center = pad.left + index * groupW + groupW / 2
              const incomeH = (point.income / flowMax) * innerH
              const expenseH = (point.expense / flowMax) * innerH

              return (
                <g key={point.key}>
                  <rect
                    x={center - barW - 2}
                    y={pad.top + innerH - incomeH}
                    width={barW}
                    height={incomeH}
                    rx="3"
                    className="fill-income"
                  >
                    <title>{`${point.label} — Revenus ${formatMoney(point.income, currency)}`}</title>
                  </rect>
                  <rect
                    x={center + 2}
                    y={pad.top + innerH - expenseH}
                    width={barW}
                    height={expenseH}
                    rx="3"
                    className="fill-expense"
                  >
                    <title>{`${point.label} — Dépenses ${formatMoney(point.expense, currency)}`}</title>
                  </rect>
                  <text
                    x={center}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-current text-[10px] font-medium text-foreground-muted"
                  >
                    {point.label}
                  </text>
                </g>
              )
            })}

            {/* Courbe du solde cumulé */}
            <polyline
              points={linePoints}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="text-primary"
            />
            {points.map((point, index) => (
              <circle
                key={`dot-${point.key}`}
                cx={pad.left + index * groupW + groupW / 2}
                cy={balanceY(point.balance)}
                r="3.5"
                className="fill-primary"
                stroke="white"
                strokeWidth="1.5"
              >
                <title>{`${point.label} — Solde ${formatMoney(point.balance, currency)}`}</title>
              </circle>
            ))}
          </svg>

          <Caption className="mt-2 block">
            Flux max {formatCompact(flowMax, currency)} · Solde de {formatCompact(balanceMin, currency)} à{' '}
            {formatCompact(balanceMax, currency)} (échelle propre)
          </Caption>
        </>
      )}
    </Card>
  )
}
