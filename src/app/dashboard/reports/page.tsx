import type { Metadata } from 'next'
import { ArrowDownLeft, CalendarClock, PiggyBank, TrendingDown } from 'lucide-react'
import { requireUser } from '@/lib/user-context'
import { formatMoney, formatPercent, formatSigned } from '@/lib/money'
import { getFinancialReport, parseReportPeriod } from '@/lib/reports'
import { EvolutionBadge, StatsCard } from '@/components/dashboard/stats-card'
import { CategoryReportTable } from '@/components/reports/category-report-table'
import { ReportToolbar } from '@/components/reports/report-toolbar'
import { Caption, Heading } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: 'PF | Rapports',
}

type SearchParams = Record<string, string | string[] | undefined>

function pick(params: SearchParams, key: string) {
  const value = params[key]
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireUser()

  const params = await searchParams
  const period = parseReportPeriod(pick(params, 'year'), pick(params, 'month'))
  const report = await getFinancialReport(user.id, user.currency, period.year, period.month)
  const currency = report.currency
  const rate =
    report.savingsRate === null
      ? 'Taux d’épargne indisponible sans revenu'
      : `Taux d’épargne ${formatPercent(report.savingsRate, Number.isInteger(report.savingsRate) ? 0 : 1)}`

  return (
    <div className="print-sheet mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <Heading as="h1" size="xl">
          Rapports &amp; Exports
        </Heading>
        <Caption className="mt-1 block">
          {report.periodLabel} · Dépenses totales {formatMoney(report.expenses, currency)} · {rate}
        </Caption>
      </div>

      <ReportToolbar year={report.year} month={report.month} years={report.availableYears} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Revenus"
          value={formatMoney(report.income, currency)}
          tone="income"
          icon={<ArrowDownLeft className="h-5 w-5" />}
          hint={<EvolutionBadge value={report.incomeEvolution} label={report.comparisonLabel} />}
        />
        <StatsCard
          title="Dépenses fixes"
          value={formatMoney(report.fixedExpenses, currency)}
          tone="expense"
          icon={<CalendarClock className="h-5 w-5" />}
          hint={<EvolutionBadge value={report.fixedEvolution} invert label={report.comparisonLabel} />}
        />
        <StatsCard
          title="Dépenses variables"
          value={formatMoney(report.variableExpenses, currency)}
          tone="expense"
          icon={<TrendingDown className="h-5 w-5" />}
          hint={<EvolutionBadge value={report.variableEvolution} invert label={report.comparisonLabel} />}
        />
        <StatsCard
          title="Épargne nette"
          value={formatSigned(report.netSavings, currency)}
          tone={report.netSavings >= 0 ? 'income' : 'expense'}
          icon={<PiggyBank className="h-5 w-5" />}
          hint={
            <span className="flex flex-col gap-1">
              <EvolutionBadge value={report.savingsEvolution} label={report.comparisonLabel} />
              <span>{rate}</span>
            </span>
          }
        />
      </section>

      <CategoryReportTable
        rows={report.categories}
        currency={currency}
        comparisonLabel={report.comparisonLabel}
        budgetScopeLabel={report.budgetScopeLabel}
      />
    </div>
  )
}
