import { CategoryType, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { accountBalance, accountTypeLabels } from '@/lib/accounts'
import {
  buildBudgetGauge,
  computeDisposableIncome,
  resolveMonthlyLimit,
  type BudgetGauge,
  type DisposableIncome,
} from '@/lib/budget'
import { lastMonths, monthKey, monthLabel, monthRange, previousMonthRange } from '@/lib/dates'
import { evolution, round2, toNumber } from '@/lib/money'

export type AccountSummary = {
  publicId: string
  name: string
  typeLabel: string
  icon: string
  balance: number
}

export type CategorySlice = {
  publicId: string
  name: string
  color: string
  icon: string
  amount: number
  share: number
}

export type MonthPoint = {
  key: string
  label: string
  income: number
  expense: number
  /** Solde net cumulé à la fin du mois. */
  balance: number
}

export type DashboardAnalytics = {
  currency: string
  todayLabel: string
  monthLabel: string

  /** Carte 1 — solde global tous comptes. */
  globalBalance: number
  accounts: AccountSummary[]

  /** Carte 2 — revenus vs dépenses du mois + évolution. */
  monthIncome: number
  monthExpense: number
  incomeEvolution: number | null
  expenseEvolution: number | null

  /** Carte 3 — reste à dépenser / reste à vivre. */
  disposable: DisposableIncome
  /** Reste à dépenser sur l'ensemble des catégories plafonnées. */
  budgetRemaining: number
  budgetTotalLimit: number

  gauges: BudgetGauge[]
  expenseBreakdown: CategorySlice[]
  history: MonthPoint[]

  transactionCount: number
}

type MovementRow = {
  type: TransactionType
  amount: unknown
  accountId: number
  toAccountId: number | null
}

function sumExpenses(rows: Array<{ type: TransactionType; amount: unknown }>) {
  return round2(
    rows
      .filter((row) => row.type === TransactionType.EXPENSE)
      .reduce((total, row) => total + toNumber(row.amount as never), 0),
  )
}

function sumIncome(rows: Array<{ type: TransactionType; amount: unknown }>) {
  return round2(
    rows
      .filter((row) => row.type === TransactionType.INCOME)
      .reduce((total, row) => total + toNumber(row.amount as never), 0),
  )
}

export async function getDashboardAnalytics(
  userId: number,
  currency: string,
): Promise<DashboardAnalytics> {
  const now = new Date()
  const current = monthRange(now)
  const previous = previousMonthRange(now)
  const windowMonths = lastMonths(6, now)
  const historyStart = windowMonths[0].start

  const [accountRows, allMovements, monthRows, previousRows, historyRows, categories, goals, transactionCount] =
    await Promise.all([
      prisma.account.findMany({
        where: { userId, isArchived: false },
        orderBy: { name: 'asc' },
        select: { id: true, publicId: true, name: true, type: true, balance: true },
      }),
      prisma.transaction.findMany({
        where: { userId },
        select: { type: true, amount: true, accountId: true, toAccountId: true },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: current.start, lt: current.end } },
        select: { type: true, amount: true, isRecurring: true, categoryId: true },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: previous.start, lt: previous.end } },
        select: { type: true, amount: true },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: historyStart, lt: current.end } },
        select: { type: true, amount: true, date: true },
      }),
      prisma.category.findMany({
        where: { userId, isArchived: false },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          publicId: true,
          name: true,
          type: true,
          icon: true,
          color: true,
          budgetLimit: true,
        },
      }),
      prisma.budgetGoal.findMany({
        where: { userId, period: 'MONTH' },
        select: { categoryId: true, monthlyLimit: true, alertThreshold: true },
      }),
      prisma.transaction.count({ where: { userId } }),
    ])

  // ---- Carte 1 : solde global tous comptes ----
  const movements = (allMovements as MovementRow[]).map((row) => ({
    type: row.type,
    amount: toNumber(row.amount as never),
    accountId: row.accountId,
    toAccountId: row.toAccountId,
  }))

  const accounts: AccountSummary[] = accountRows.map((account) => ({
    publicId: account.publicId,
    name: account.name,
    typeLabel: accountTypeLabels[account.type],
    icon: account.type,
    balance: round2(accountBalance(account.id, toNumber(account.balance), movements)),
  }))

  const globalBalance = round2(accounts.reduce((total, account) => total + account.balance, 0))

  // ---- Carte 2 : revenus vs dépenses du mois ----
  const monthIncome = sumIncome(monthRows)
  const monthExpense = sumExpenses(monthRows)
  const previousIncome = sumIncome(previousRows)
  const previousExpense = sumExpenses(previousRows)

  // ---- Carte 3 : reste à vivre ----
  const expenseRows = monthRows.filter((row) => row.type === TransactionType.EXPENSE)
  const fixedCharges = round2(
    expenseRows
      .filter((row) => row.isRecurring)
      .reduce((total, row) => total + toNumber(row.amount as never), 0),
  )
  const variableExpenses = round2(
    expenseRows
      .filter((row) => !row.isRecurring)
      .reduce((total, row) => total + toNumber(row.amount as never), 0),
  )

  const disposable = computeDisposableIncome({
    income: monthIncome,
    fixedCharges,
    variableExpenses,
  })

  // ---- Jauges de budget par catégorie ----
  const goalByCategory = new Map(goals.map((goal) => [goal.categoryId, goal]))
  const spentByCategory = new Map<number, number>()
  for (const row of expenseRows) {
    if (row.categoryId === null) continue
    spentByCategory.set(
      row.categoryId,
      round2((spentByCategory.get(row.categoryId) ?? 0) + toNumber(row.amount as never)),
    )
  }

  const gauges = categories
    .filter((category) => category.type === CategoryType.EXPENSE)
    .map((category) => {
      const goal = goalByCategory.get(category.id)
      const limit = resolveMonthlyLimit(
        toNumber(category.budgetLimit) || null,
        goal ? toNumber(goal.monthlyLimit) : null,
      )
      if (limit === null) return null

      return buildBudgetGauge({
        categoryPublicId: category.publicId,
        name: category.name,
        icon: category.icon,
        color: category.color,
        limit,
        spent: spentByCategory.get(category.id) ?? 0,
        alertThreshold: goal?.alertThreshold ?? 80,
      })
    })
    .filter((gauge): gauge is BudgetGauge => gauge !== null)
    .sort((left, right) => right.ratio - left.ratio)

  const budgetTotalLimit = round2(gauges.reduce((total, gauge) => total + gauge.limit, 0))
  const budgetSpent = round2(gauges.reduce((total, gauge) => total + gauge.spent, 0))

  // ---- Répartition des dépenses par catégorie ----
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const breakdown: CategorySlice[] = [...spentByCategory.entries()]
    .map(([categoryId, amount]) => {
      const category = categoryById.get(categoryId)
      return {
        publicId: category?.publicId ?? String(categoryId),
        name: category?.name ?? 'Sans catégorie',
        color: category?.color ?? '#64748b',
        icon: category?.icon ?? 'Wallet',
        amount,
        share: monthExpense > 0 ? round2((amount / monthExpense) * 100) : 0,
      }
    })
    .sort((left, right) => right.amount - left.amount)

  // ---- Évolution du solde sur 6 mois ----
  const history: MonthPoint[] = []
  let runningBalance = round2(
    globalBalance -
      (historyRows as Array<{ type: TransactionType; amount: unknown }>).reduce(
        (total, row) =>
          row.type === TransactionType.INCOME
            ? total + toNumber(row.amount as never)
            : row.type === TransactionType.EXPENSE
              ? total - toNumber(row.amount as never)
              : total,
        0,
      ),
  )

  for (const range of windowMonths) {
    const rows = (historyRows as Array<{ type: TransactionType; amount: unknown; date: Date }>).filter(
      (row) => row.date >= range.start && row.date < range.end,
    )
    const income = sumIncome(rows)
    const expense = sumExpenses(rows)
    runningBalance = round2(runningBalance + income - expense)

    history.push({
      key: monthKey(range.start),
      label: monthLabel(range.start),
      income,
      expense,
      balance: runningBalance,
    })
  }

  return {
    currency,
    todayLabel: new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now),
    monthLabel: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(now),

    globalBalance,
    accounts,

    monthIncome,
    monthExpense,
    incomeEvolution: evolution(monthIncome, previousIncome),
    expenseEvolution: evolution(monthExpense, previousExpense),

    disposable,
    budgetRemaining: round2(budgetTotalLimit - budgetSpent),
    budgetTotalLimit,

    gauges,
    expenseBreakdown: breakdown,
    history,

    transactionCount,
  }
}
