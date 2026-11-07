import { Card } from '@/components/ui/card'
import { Caption, Heading } from '@/components/ui/typography'
import type { ProjectionPoint } from '@/lib/projections'
import { formatDate } from '@/lib/dates'
import { formatCompact, formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'

type ChartPoint = ProjectionPoint & { label: string }

type ProjectionChartProps = {
  points: ChartPoint[]
  currency: string
  criticalThreshold: number
  className?: string
}

export function ProjectionChart({
  points,
  currency,
  criticalThreshold,
  className,
}: ProjectionChartProps) {
  const width = 680
  const height = 260
  const pad = { top: 40, right: 36, bottom: 36, left: 36 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const values = points.map((point) => point.balance)
  const min = Math.min(...values, criticalThreshold)
  const max = Math.max(...values, criticalThreshold)
  const span = max - min || 1

  function xAt(index: number) {
    if (points.length <= 1) return pad.left + innerW / 2
    return pad.left + (index / (points.length - 1)) * innerW
  }

  function yAt(value: number) {
    return pad.top + innerH - ((value - min) / span) * innerH
  }

  const line = points.map((point, index) => `${xAt(index)},${yAt(point.balance)}`).join(' ')
  const area = `${xAt(0)},${yAt(min)} ${line} ${xAt(points.length - 1)},${yAt(min)}`
  const zeroY = yAt(criticalThreshold)
  const showZero = min < criticalThreshold && max > criticalThreshold

  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-4">
        <Heading as="h2" size="lg">
          Projection du solde
        </Heading>
        <Caption className="mt-1 block">
          Évolution estimée à 30, 60 et 90 jours, au rythme variable actuel et avec les récurrences actives.
        </Caption>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-64 w-full"
        role="img"
        aria-label={points
          .map((point) => `${point.label} : ${formatMoney(point.balance, currency)}`)
          .join(', ')}
      >
        {showZero ? (
          <g>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={zeroY}
              y2={zeroY}
              stroke="#d97706"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
            <text x={pad.left - 8} y={zeroY + 4} textAnchor="end" className="fill-warning" fontSize="11">
              0
            </text>
          </g>
        ) : null}

        <polygon points={area} className="fill-primary/10" />
        <polyline points={line} fill="none" className="stroke-primary" strokeWidth="2.5" />

        {points.map((point, index) => {
          const critical = point.balance <= criticalThreshold
          return (
            <g key={point.horizonDays}>
              <circle
                cx={xAt(index)}
                cy={yAt(point.balance)}
                r="5"
                className={critical ? 'fill-warning' : 'fill-primary'}
              />
              <text
                x={xAt(index)}
                y={yAt(point.balance) - 12}
                textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                className={critical ? 'fill-warning' : 'fill-slate-900'}
                fontSize="12"
                fontWeight="700"
              >
                {formatCompact(point.balance, currency)}
              </text>
              <text
                x={xAt(index)}
                y={height - 12}
                textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                className="fill-slate-500"
                fontSize="12"
                fontWeight="700"
              >
                {point.label}
              </text>
            </g>
          )
        })}
      </svg>

      <ul className="mt-2 grid gap-2 sm:grid-cols-4">
        {points.map((point) => (
          <li key={point.horizonDays} className="rounded-xl bg-background px-3 py-2">
            <Caption weight="bold" className="tracking-wide uppercase">
              {point.label}
            </Caption>
            <p
              className={cn(
                'mt-0.5 truncate text-sm font-bold',
                point.balance <= criticalThreshold ? 'text-warning' : 'text-foreground',
              )}
            >
              {formatMoney(point.balance, currency)}
            </p>
            <Caption className="block">{formatDate(point.date)}</Caption>
          </li>
        ))}
      </ul>
    </Card>
  )
}
