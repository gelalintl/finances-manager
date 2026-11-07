'use server'

import { TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/user-context'
import { accountBalance } from '@/lib/accounts'
import { monthRange, yearRange } from '@/lib/dates'
import { round2, toNumber } from '@/lib/money'
import { buildFinancialProjections, type FinancialProjections } from '@/lib/projections'

export type { FinancialProjections }

/**
 * Projection du patrimoine à partir du journal, des récurrences actives
 * et du rythme de dépense variable du mois en cours.
 */
export async function getFinancialProjections(): Promise<FinancialProjections> {
  const user = await requireUser()

  const now = new Date()
  const month = monthRange(now)
  const year = yearRange(now)
  const userId = user.id

  const [accounts, movements, variableRows, schedules, posts] = await Promise.all([
    prisma.account.findMany({
      where: { userId, isArchived: false },
      select: { id: true, balance: true },
    }),
    prisma.transaction.findMany({
      where: { userId },
      select: { type: true, amount: true, accountId: true, toAccountId: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        type: TransactionType.EXPENSE,
        isRecurring: false,
        date: { gte: month.start, lt: month.end },
      },
      select: { amount: true },
    }),
    prisma.recurringTransaction.findMany({
      where: { userId, active: true },
      select: {
        id: true,
        type: true,
        amount: true,
        frequency: true,
        dayOfMonth: true,
        active: true,
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        recurringTransactionId: { not: null },
        date: { gte: year.start, lt: year.end },
      },
      select: { recurringTransactionId: true, date: true },
    }),
  ])

  const ledger = movements.map((row) => ({
    type: row.type,
    amount: toNumber(row.amount),
    accountId: row.accountId,
    toAccountId: row.toAccountId,
  }))

  const currentBalance = round2(
    accounts.reduce(
      (total, account) => total + accountBalance(account.id, toNumber(account.balance), ledger),
      0,
    ),
  )

  const variableExpenses = round2(
    variableRows.reduce((total, row) => total + toNumber(row.amount), 0),
  )

  const postedKeys = posts.flatMap((post) => {
    const id = post.recurringTransactionId
    if (id === null) return []
    const monthKey = `${id}:${post.date.getFullYear()}-${String(post.date.getMonth() + 1).padStart(2, '0')}`
    const yearKey = `${id}:${post.date.getFullYear()}`
    return [monthKey, yearKey]
  })

  return buildFinancialProjections({
    now,
    currentBalance,
    variableExpenses,
    postedKeys,
    schedules: schedules.map((schedule) => ({
      id: schedule.id,
      type: schedule.type,
      amount: toNumber(schedule.amount),
      frequency: schedule.frequency,
      dayOfMonth: schedule.dayOfMonth,
      active: schedule.active,
    })),
  })
}
