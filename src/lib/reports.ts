import { CategoryType, TransactionType, type BudgetPeriod } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveMonthlyLimit } from '@/lib/budget'
import { formatDate } from '@/lib/dates'
import { evolution, round2, toNumber } from '@/lib/money'
import { transactionTypeLabels } from '@/lib/transactions'

export type ReportPeriod = {
  year: number
  month: number | null
}

export type CategoryReportRow = {
  publicId: string | null
  name: string
  icon: string
  color: string
  /** Plafond de la période (mensuel, ou mensuel × 12 sur une année). */
  budgetLimit: number | null
  spent: number
  previousSpent: number
  variation: number | null
  /** Plafond − dépense. Positif = économie, négatif = dépassement. */
  gap: number | null
  share: number
}

export type PeriodTotals = {
  income: number
  expenses: number
  fixedExpenses: number
  variableExpenses: number
  netSavings: number
  /** Null quand il n'y a aucun revenu : un taux n'a pas de base. */
  savingsRate: number | null
}

export type FinancialReport = {
  year: number
  month: number | null
  periodLabel: string
  comparisonLabel: string
  budgetScopeLabel: string
  currency: string
  availableYears: number[]
  income: number
  expenses: number
  fixedExpenses: number
  variableExpenses: number
  netSavings: number
  savingsRate: number | null
  incomeEvolution: number | null
  fixedEvolution: number | null
  variableEvolution: number | null
  savingsEvolution: number | null
  categories: CategoryReportRow[]
}

type Movement = {
  type: TransactionType
  amount: number
  isRecurring: boolean
  categoryId: number | null
  date: Date
}

const MONTH_MIN = 2000
const MONTH_MAX = 2100

export function parseReportPeriod(yearRaw: unknown, monthRaw: unknown, now = new Date()): ReportPeriod {
  const parsedYear = Number(yearRaw)
  const year =
    Number.isInteger(parsedYear) && parsedYear >= MONTH_MIN && parsedYear <= MONTH_MAX
      ? parsedYear
      : now.getFullYear()

  const monthText = String(monthRaw ?? '').trim().toLowerCase()
  if (monthText === 'all' || monthText === 'annee' || monthText === 'année') {
    return { year, month: null }
  }

  if (!monthText) return { year, month: now.getMonth() + 1 }

  const parsedMonth = Number(monthText)
  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return { year, month: now.getMonth() + 1 }
  }
  return { year, month: parsedMonth }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function periodLabel(year: number, month: number | null) {
  if (month === null) return String(year)
  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
  return capitalize(label)
}

function windowFor(year: number, month: number | null) {
  if (month === null) {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year + 1, 0, 1),
      previousStart: new Date(year - 1, 0, 1),
      previousEnd: new Date(year, 0, 1),
      comparisonLabel: 'vs N-1',
      budgetScopeLabel: 'Plafond annuel (mensuel × 12)',
      monthsInPeriod: 12,
    }
  }

  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
    previousStart: new Date(year, month - 2, 1),
    previousEnd: new Date(year, month - 1, 1),
    comparisonLabel: 'vs M-1',
    budgetScopeLabel: 'Plafond du mois',
    monthsInPeriod: 1,
  }
}

function inRange(date: Date, start: Date, end: Date) {
  const time = date.getTime()
  return time >= start.getTime() && time < end.getTime()
}

function summarize(rows: Movement[]): PeriodTotals {
  let income = 0
  let fixedExpenses = 0
  let variableExpenses = 0

  for (const row of rows) {
    if (row.type === TransactionType.INCOME) income += row.amount
    if (row.type === TransactionType.EXPENSE) {
      if (row.isRecurring) fixedExpenses += row.amount
      else variableExpenses += row.amount
    }
  }

  income = round2(income)
  fixedExpenses = round2(fixedExpenses)
  variableExpenses = round2(variableExpenses)
  const expenses = round2(fixedExpenses + variableExpenses)
  const netSavings = round2(income - expenses)

  return {
    income,
    expenses,
    fixedExpenses,
    variableExpenses,
    netSavings,
    savingsRate: income > 0 ? round2((netSavings / income) * 100) : null,
  }
}

function spendByCategory(rows: Movement[]) {
  const totals = new Map<number | null, number>()
  for (const row of rows) {
    if (row.type !== TransactionType.EXPENSE) continue
    totals.set(row.categoryId, round2((totals.get(row.categoryId) ?? 0) + row.amount))
  }
  return totals
}

export function buildFinancialReport(input: {
  year: number
  month: number | null
  currency: string
  availableYears: number[]
  movements: Movement[]
  categories: Array<{
    id: number
    publicId: string
    name: string
    icon: string
    color: string
    budgetLimit: number | null
    isArchived: boolean
  }>
  goals: Array<{ categoryId: number; monthlyLimit: number }>
}): FinancialReport {
  const window = windowFor(input.year, input.month)
  const currentRows = input.movements.filter((row) => inRange(row.date, window.start, window.end))
  const previousRows = input.movements.filter((row) =>
    inRange(row.date, window.previousStart, window.previousEnd),
  )
  const current = summarize(currentRows)
  const previous = summarize(previousRows)
  const currentSpend = spendByCategory(currentRows)
  const previousSpend = spendByCategory(previousRows)
  const goalByCategory = new Map(input.goals.map((goal) => [goal.categoryId, goal.monthlyLimit]))

  const rows: CategoryReportRow[] = []

  for (const category of input.categories) {
    const spent = currentSpend.get(category.id) ?? 0
    const prior = previousSpend.get(category.id) ?? 0
    const monthly = resolveMonthlyLimit(category.budgetLimit, goalByCategory.get(category.id) ?? null)
    const budgetLimit = monthly === null ? null : round2(monthly * window.monthsInPeriod)
    if (spent === 0 && prior === 0 && (category.isArchived || budgetLimit === null)) continue

    rows.push({
      publicId: category.publicId,
      name: category.name,
      icon: category.icon,
      color: category.color,
      budgetLimit,
      spent,
      previousSpent: prior,
      variation: evolution(spent, prior),
      gap: budgetLimit === null ? null : round2(budgetLimit - spent),
      share: current.expenses > 0 ? round2((spent / current.expenses) * 100) : 0,
    })
  }

  const uncategorized = currentSpend.get(null) ?? 0
  const uncategorizedPrior = previousSpend.get(null) ?? 0
  if (uncategorized > 0 || uncategorizedPrior > 0) {
    rows.push({
      publicId: null,
      name: 'Sans catégorie',
      icon: 'Wallet',
      color: '#64748b',
      budgetLimit: null,
      spent: uncategorized,
      previousSpent: uncategorizedPrior,
      variation: evolution(uncategorized, uncategorizedPrior),
      gap: null,
      share: current.expenses > 0 ? round2((uncategorized / current.expenses) * 100) : 0,
    })
  }

  rows.sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name, 'fr'))

  return {
    year: input.year,
    month: input.month,
    periodLabel: periodLabel(input.year, input.month),
    comparisonLabel: window.comparisonLabel,
    budgetScopeLabel: window.budgetScopeLabel,
    currency: input.currency,
    availableYears: input.availableYears,
    ...current,
    incomeEvolution: evolution(current.income, previous.income),
    fixedEvolution: evolution(current.fixedExpenses, previous.fixedExpenses),
    variableEvolution: evolution(current.variableExpenses, previous.variableExpenses),
    savingsEvolution: evolution(current.netSavings, previous.netSavings),
    categories: rows,
  }
}

export async function getFinancialReport(
  userId: number,
  currency: string,
  year: number,
  month?: number | null,
): Promise<FinancialReport> {
  const period = parseReportPeriod(year, month === null ? 'all' : month)
  const window = windowFor(period.year, period.month)

  const [movements, categories, goals, oldest] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: window.previousStart, lt: window.end } },
      select: {
        type: true,
        amount: true,
        isRecurring: true,
        categoryId: true,
        date: true,
      },
    }),
    prisma.category.findMany({
      where: { userId, type: CategoryType.EXPENSE },
      select: {
        id: true,
        publicId: true,
        name: true,
        icon: true,
        color: true,
        budgetLimit: true,
        isArchived: true,
      },
    }),
    prisma.budgetGoal.findMany({
      where: { userId, period: 'MONTH' satisfies BudgetPeriod },
      select: { categoryId: true, monthlyLimit: true },
    }),
    prisma.transaction.aggregate({
      where: { userId },
      _min: { date: true },
    }),
  ])

  const currentYear = new Date().getFullYear()
  const firstYear = oldest._min.date?.getFullYear() ?? currentYear
  const availableYears: number[] = []
  for (let value = Math.max(currentYear, period.year); value >= Math.min(firstYear, period.year); value -= 1) {
    availableYears.push(value)
  }

  return buildFinancialReport({
    year: period.year,
    month: period.month,
    currency,
    availableYears,
    movements: movements.map((row) => ({
      type: row.type,
      amount: toNumber(row.amount),
      isRecurring: row.isRecurring,
      categoryId: row.categoryId,
      date: row.date,
    })),
    categories: categories.map((category) => ({
      ...category,
      budgetLimit: category.budgetLimit === null ? null : toNumber(category.budgetLimit),
    })),
    goals: goals.map((goal) => ({
      categoryId: goal.categoryId,
      monthlyLimit: toNumber(goal.monthlyLimit),
    })),
  })
}

export type CsvExportFilters = {
  year: number
  month?: number | null
  type?: TransactionType | 'all'
}

function csvCell(value: string) {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  if (/[;"\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`
  return guarded
}

function csvAmount(amount: number) {
  return round2(amount).toLocaleString('fr-FR', {
    useGrouping: false,
    minimumFractionDigits: Number.isInteger(round2(amount)) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function transactionsToCsv(
  rows: Array<{
    date: Date
    type: TransactionType
    categoryName: string | null
    accountName: string
    toAccountName: string | null
    description: string | null
    amount: number
    isRecurring: boolean
  }>,
  currency: string,
) {
  const header = [
    'Date',
    'Type',
    'Catégorie',
    'Compte',
    'Description',
    `Montant (${currency})`,
    'Statut récurrent',
  ]
  const lines = rows.map((row) => {
    const account =
      row.type === TransactionType.TRANSFER && row.toAccountName
        ? `${row.accountName} → ${row.toAccountName}`
        : row.accountName
    return [
      formatDate(row.date),
      transactionTypeLabels[row.type],
      row.categoryName ?? '',
      account,
      row.description ?? '',
      csvAmount(row.amount),
      row.isRecurring ? 'Récurrent' : 'Ponctuel',
    ]
      .map(csvCell)
      .join(';')
  })

  return `\uFEFF${[header.map(csvCell).join(';'), ...lines].join('\r\n')}\r\n`
}

export async function exportTransactionsCSV(userId: number, currency: string, filters: CsvExportFilters) {
  const period = parseReportPeriod(filters.year, filters.month === null ? 'all' : filters.month)
  const window = windowFor(period.year, period.month)
  const type = filters.type && filters.type !== 'all' ? filters.type : undefined

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: window.start, lt: window.end },
      ...(type ? { type } : {}),
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    select: {
      date: true,
      type: true,
      amount: true,
      description: true,
      isRecurring: true,
      category: { select: { name: true } },
      account: { select: { name: true } },
      toAccount: { select: { name: true } },
    },
  })

  const filename =
    period.month === null
      ? `rapport-${period.year}.csv`
      : `rapport-${period.year}-${String(period.month).padStart(2, '0')}.csv`

  return {
    filename,
    csv: transactionsToCsv(
      rows.map((row) => ({
        date: row.date,
        type: row.type,
        categoryName: row.category?.name ?? null,
        accountName: row.account.name,
        toAccountName: row.toAccount?.name ?? null,
        description: row.description,
        amount: toNumber(row.amount),
        isRecurring: row.isRecurring,
      })),
      currency,
    ),
  }
}
