import { DebtStatus, Frequency, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { clampDayOfMonth, monthRange, yearRange } from '@/lib/dates'
import { toNumber } from '@/lib/money'

export type DeadlineTone = 'neutral' | 'warning' | 'danger'

export type DeadlineItem = {
  id: string
  kind: 'recurring' | 'debt'
  title: string
  detail: string
  amount: number
  date: string
  daysUntil: number
  tone: DeadlineTone
  href: string
}

const WINDOW_DAYS = 7

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysUntilDate(target: Date, now = new Date()) {
  const ms = startOfDay(target).getTime() - startOfDay(now).getTime()
  return Math.round(ms / 86_400_000)
}

/** Orange à 3 jours ou moins, rouge si la date est déjà passée. */
export function deadlineTone(daysUntil: number): DeadlineTone {
  if (daysUntil < 0) return 'danger'
  if (daysUntil <= 3) return 'warning'
  return 'neutral'
}

export function deadlineWhenLabel(daysUntil: number) {
  if (daysUntil < 0) {
    const late = Math.abs(daysUntil)
    return `Retard de ${late} jour${late > 1 ? 's' : ''}`
  }
  if (daysUntil === 0) return "Aujourd'hui"
  if (daysUntil === 1) return 'Demain'
  return `Dans ${daysUntil} jours`
}

function atNoon(year: number, month: number, day: number) {
  return new Date(year, month, day, 12, 0, 0, 0)
}

function occurrenceThisMonth(dayOfMonth: number, now: Date) {
  return atNoon(
    now.getFullYear(),
    now.getMonth(),
    clampDayOfMonth(dayOfMonth, now.getFullYear(), now.getMonth()),
  )
}

function nextOccurrence(dayOfMonth: number, now: Date) {
  const current = occurrenceThisMonth(dayOfMonth, now)
  if (startOfDay(current).getTime() >= startOfDay(now).getTime()) return current
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return atNoon(
    next.getFullYear(),
    next.getMonth(),
    clampDayOfMonth(dayOfMonth, next.getFullYear(), next.getMonth()),
  )
}

export async function getUpcomingDeadlines(userId: number, now = new Date()): Promise<DeadlineItem[]> {
  const month = monthRange(now)
  const year = yearRange(now)
  const horizon = atNoon(now.getFullYear(), now.getMonth(), now.getDate() + WINDOW_DAYS)

  const [recurring, posts, debts] = await Promise.all([
    prisma.recurringTransaction.findMany({
      where: { userId, active: true },
      select: {
        id: true,
        publicId: true,
        label: true,
        type: true,
        amount: true,
        frequency: true,
        dayOfMonth: true,
        account: { select: { name: true } },
      },
      orderBy: { dayOfMonth: 'asc' },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        recurringTransactionId: { not: null },
        date: { gte: year.start, lt: year.end },
      },
      select: { recurringTransactionId: true, date: true },
    }),
    prisma.debt.findMany({
      where: {
        userId,
        status: { not: DebtStatus.PAID },
        dueDate: { not: null, lte: horizon },
      },
      select: {
        publicId: true,
        type: true,
        personName: true,
        remainingAmount: true,
        dueDate: true,
      },
      orderBy: { dueDate: 'asc' },
    }),
  ])

  const postedThisMonth = new Set<number>()
  const postedThisYear = new Set<number>()
  for (const post of posts) {
    if (post.recurringTransactionId === null) continue
    postedThisYear.add(post.recurringTransactionId)
    if (post.date >= month.start && post.date < month.end) {
      postedThisMonth.add(post.recurringTransactionId)
    }
  }

  const items: DeadlineItem[] = []

  for (const row of recurring) {
    const posted =
      row.frequency === Frequency.YEARLY ? postedThisYear.has(row.id) : postedThisMonth.has(row.id)
    if (posted) continue

    const thisMonth = occurrenceThisMonth(row.dayOfMonth, now)
    const overdue = daysUntilDate(thisMonth, now) < 0
    const date = overdue ? thisMonth : nextOccurrence(row.dayOfMonth, now)
    const daysUntil = daysUntilDate(date, now)
    if (!overdue && (daysUntil < 0 || daysUntil > WINDOW_DAYS)) continue

    items.push({
      id: `recurring-${row.publicId}`,
      kind: 'recurring',
      title: row.label,
      detail: row.type === TransactionType.INCOME ? `Revenu · ${row.account.name}` : `Abonnement · ${row.account.name}`,
      amount: toNumber(row.amount),
      date: date.toISOString(),
      daysUntil,
      tone: deadlineTone(daysUntil),
      href: '/dashboard/recurring',
    })
  }

  for (const debt of debts) {
    if (!debt.dueDate) continue
    const daysUntil = daysUntilDate(debt.dueDate, now)
    if (daysUntil > WINDOW_DAYS) continue
    items.push({
      id: `debt-${debt.publicId}`,
      kind: 'debt',
      title: debt.personName,
      detail: debt.type === 'DEBT' ? 'Dette à rembourser' : 'Créance à recouvrer',
      amount: toNumber(debt.remainingAmount),
      date: debt.dueDate.toISOString(),
      daysUntil,
      tone: deadlineTone(daysUntil),
      href: '/dashboard/debts',
    })
  }

  items.sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title, 'fr'))
  return items
}
