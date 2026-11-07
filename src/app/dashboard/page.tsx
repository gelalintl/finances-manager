import type { Metadata } from 'next'
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react'
import { requireUser } from '@/lib/user-context'
import { getDashboardAnalytics } from '@/lib/analytics'
import { EvolutionBadge, StatsCard } from '@/components/dashboard/stats-card'
import { BudgetGauges } from '@/components/dashboard/budget-gauges'
import { ExpenseDonut } from '@/components/dashboard/expense-donut'
import { BalanceTrendChart } from '@/components/dashboard/balance-trend-chart'
import { AccountsSummary } from '@/components/dashboard/accounts-summary'
import { DisposableIncomeCard } from '@/components/dashboard/disposable-income'
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { formatMoney } from '@/lib/money'

export const metadata: Metadata = {
  title: 'PF | Tableau de bord',
}

export default async function DashboardPage() {
  const user = await requireUser()

  const analytics = await getDashboardAnalytics(user.id, user.currency)
  const firstName = user.name.split(' ')[0]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header>
        <Heading as="h1" size="xl">
          Bonjour {firstName}
        </Heading>
        <Text variant="muted" size="sm" className="mt-1 capitalize">
          {analytics.todayLabel}
        </Text>
      </header>

      {/* --- Les trois cartes de récapitulatif --- */}
      <section className="grid gap-4 lg:grid-cols-3">
        <StatsCard
          title="Solde global"
          value={formatMoney(analytics.globalBalance, analytics.currency)}
          tone="default"
          icon={<Wallet className="h-5 w-5" />}
          hint={`${analytics.accounts.length} compte${analytics.accounts.length > 1 ? 's' : ''} · ${
            analytics.transactionCount
          } transactions`}
        />

        <StatsCard
          title="Revenus vs dépenses"
          value={formatMoney(analytics.monthIncome - analytics.monthExpense, analytics.currency)}
          tone={analytics.monthIncome >= analytics.monthExpense ? 'income' : 'expense'}
          icon={
            analytics.monthIncome >= analytics.monthExpense ? (
              <ArrowUpRight className="h-5 w-5" />
            ) : (
              <ArrowDownLeft className="h-5 w-5" />
            )
          }
          hint={
            <span className="flex flex-col gap-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-income">
                  + {formatMoney(analytics.monthIncome, analytics.currency)}
                </span>
                <EvolutionBadge value={analytics.incomeEvolution} />
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="text-expense">
                  &minus; {formatMoney(analytics.monthExpense, analytics.currency)}
                </span>
                <EvolutionBadge value={analytics.expenseEvolution} invert />
              </span>
            </span>
          }
        />

        <StatsCard
          title="Reste à dépenser"
          value={formatMoney(analytics.disposable.disposable, analytics.currency)}
          tone={analytics.disposable.disposable < 0 ? 'expense' : 'income'}
          icon={<Wallet className="h-5 w-5" />}
          hint={
            analytics.budgetTotalLimit > 0
              ? `Enveloppes budgétées : ${formatMoney(
                  analytics.budgetRemaining,
                  analytics.currency,
                )} restants sur ${formatMoney(analytics.budgetTotalLimit, analytics.currency)}`
              : 'Aucune enveloppe budgétaire définie'
          }
        />
      </section>

      <UpcomingDeadlines userId={user.id} currency={user.currency} />

      {/* --- Jauges de budget + reste à vivre --- */}
      <section className="grid gap-4 lg:grid-cols-3">
        <BudgetGauges
          gauges={analytics.gauges}
          currency={analytics.currency}
          className="lg:col-span-2"
        />
        <DisposableIncomeCard data={analytics.disposable} currency={analytics.currency} />
      </section>

      {/* --- Graphiques --- */}
      <section className="grid gap-4 lg:grid-cols-5">
        <BalanceTrendChart
          points={analytics.history}
          currency={analytics.currency}
          className="lg:col-span-3"
        />
        <ExpenseDonut
          slices={analytics.expenseBreakdown}
          total={analytics.monthExpense}
          currency={analytics.currency}
          className="lg:col-span-2"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <AccountsSummary accounts={analytics.accounts} currency={analytics.currency} />
        <div className="lg:col-span-2">
          <Caption className="block">
            Les soldes sont recalculés à partir du journal des transactions : un virement interne est
            neutre sur le solde global, il déplace seulement la trésorerie entre deux comptes.
          </Caption>
        </div>
      </section>
    </div>
  )
}
