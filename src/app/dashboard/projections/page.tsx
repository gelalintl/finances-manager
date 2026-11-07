import type { Metadata } from 'next'
import { CalendarClock, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { requireUser } from '@/lib/user-context'
import { formatMoney } from '@/lib/money'
import { StatsCard } from '@/components/dashboard/stats-card'
import { Caption, Heading } from '@/components/ui/typography'
import { ProjectionChart } from '@/components/projections/projection-chart'
import { ProjectionAlert } from '@/components/projections/projection-alert'
import { SavingsSimulator } from '@/components/projections/savings-simulator'
import { getFinancialProjections } from './actions'
import { cn } from '@/lib/cn'

export const metadata: Metadata = {
  title: 'PF | Projections',
}

export default async function ProjectionsPage() {
  const user = await requireUser()
  const projections = await getFinancialProjections()
  const currency = user.currency
  const delta = projections.endOfMonthBalance - projections.currentBalance
  const rising = delta >= 0
  const chartPoints = [
    {
      horizonDays: 0,
      label: "Aujourd'hui",
      date: projections.asOf,
      balance: projections.currentBalance,
    },
    ...projections.horizons,
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <ProjectionAlert crossesZero={projections.crossesZero} />

      <header>
        <Heading as="h1" size="xl">
          Projections
        </Heading>
        <Caption className="mt-1 block">
          Solde estimé en fin de mois, puis à 30, 60 et 90 jours.
        </Caption>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <StatsCard
          title="Solde actuel"
          value={formatMoney(projections.currentBalance, currency)}
          icon={<Wallet className="h-5 w-5" />}
          hint={
            <span className="flex flex-col gap-1">
              <span>
                Fin de mois{' '}
                <span className="font-bold text-foreground">
                  {formatMoney(projections.endOfMonthBalance, currency)}
                </span>
              </span>
              <span
                className={cn(
                  'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
                  rising ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense',
                )}
              >
                {rising ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {rising ? '+' : '−'}
                {formatMoney(Math.abs(delta), currency)}
              </span>
              {projections.crossesZero ? (
                <span className="inline-flex w-fit rounded-full bg-warning/10 px-2 py-0.5 text-xs font-bold text-warning">
                  Seuil critique franchi
                </span>
              ) : null}
            </span>
          }
        />

        <StatsCard
          title="Reste engagé"
          value={formatMoney(projections.remainingRecurringExpenses, currency)}
          tone="warning"
          icon={<CalendarClock className="h-5 w-5" />}
          hint={
            projections.remainingRecurringIncome > 0
              ? `Revenus récurrents encore à venir : ${formatMoney(projections.remainingRecurringIncome, currency)}`
              : 'Récurrences actives non encore prélevées ce mois-ci.'
          }
        />

        <StatsCard
          title="Rythme journalier"
          value={formatMoney(projections.dailySpendRate, currency)}
          tone="expense"
          icon={<TrendingDown className="h-5 w-5" />}
          hint={`${formatMoney(projections.variableExpenses, currency)} de dépenses variables sur ${projections.daysElapsed} jour${projections.daysElapsed > 1 ? 's' : ''} · ${projections.daysRemaining} jour${projections.daysRemaining > 1 ? 's' : ''} restant${projections.daysRemaining > 1 ? 's' : ''}`}
        />
      </section>

      <ProjectionChart
        points={chartPoints}
        currency={currency}
        criticalThreshold={projections.criticalThreshold}
      />

      <SavingsSimulator currency={currency} />
    </div>
  )
}
