import Link from 'next/link'
import { Bell, CalendarClock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { formatDate } from '@/lib/dates'
import {
  deadlineWhenLabel,
  getUpcomingDeadlines,
  type DeadlineTone,
} from '@/lib/deadlines'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'

const toneClass: Record<DeadlineTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-expense/10 text-expense',
}

type UpcomingDeadlinesProps = {
  userId: number
  currency: string
}

export async function UpcomingDeadlines({ userId, currency }: UpcomingDeadlinesProps) {
  const items = await getUpcomingDeadlines(userId)

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Heading as="h2" size="lg" className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Échéances à venir (7 prochains jours)
          </Heading>
          <Caption className="mt-1 block">
            Abonnements actifs et remboursements de dettes. Orange à moins de 3 jours, rouge en retard.
          </Caption>
        </div>
        <Bell className="h-4 w-4 shrink-0 text-foreground-muted" />
      </div>

      {items.length === 0 ? (
        <Text variant="muted" size="sm">
          Aucune échéance dans les 7 prochains jours, et aucun retard.
        </Text>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2.5 transition-colors hover:bg-foreground/5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{item.title}</span>
                  <Caption className="block truncate">
                    {item.detail} · {formatDate(item.date)}
                  </Caption>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-bold">{formatMoney(item.amount, currency)}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', toneClass[item.tone])}>
                    {deadlineWhenLabel(item.daysUntil)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
