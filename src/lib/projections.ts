import { Frequency, TransactionType } from '@prisma/client'
import { clampDayOfMonth, monthKey } from '@/lib/dates'
import { round2 } from '@/lib/money'

export const PROJECTION_HORIZONS = [30, 60, 90] as const
/** Seuil critique : un solde estimé à ce niveau ou en dessous déclenche l'alerte. */
export const CRITICAL_BALANCE = 0

export type ProjectionSchedule = {
  id: number
  type: TransactionType
  amount: number
  frequency: Frequency
  dayOfMonth: number
  active: boolean
}

export type ProjectionInput = {
  now: Date
  currentBalance: number
  /** Dépenses variables du mois (hors charges fixes). */
  variableExpenses: number
  schedules: ProjectionSchedule[]
  /**
   * Occurrences déjà écrites.
   * Mensuel : `id:YYYY-MM`. Annuel : `id:YYYY`.
   */
  postedKeys: string[]
}

export type ProjectionPoint = {
  horizonDays: number
  label: string
  date: string
  balance: number
}

export type FinancialProjections = {
  asOf: string
  currentBalance: number
  remainingRecurringExpenses: number
  remainingRecurringIncome: number
  variableExpenses: number
  daysElapsed: number
  daysRemaining: number
  daysInMonth: number
  dailySpendRate: number
  endOfMonthBalance: number
  horizons: ProjectionPoint[]
  crossesZero: boolean
  criticalThreshold: number
}

function atNoon(year: number, month: number, day: number) {
  return new Date(year, month, day, 12, 0, 0, 0)
}

function addDays(date: Date, days: number) {
  return atNoon(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function periodKey(schedule: ProjectionSchedule, date: Date) {
  if (schedule.frequency === Frequency.YEARLY) return `${schedule.id}:${date.getFullYear()}`
  return `${schedule.id}:${monthKey(date)}`
}

function signedAmount(schedule: ProjectionSchedule) {
  if (schedule.type === TransactionType.INCOME) return schedule.amount
  if (schedule.type === TransactionType.EXPENSE) return -schedule.amount
  return 0
}

function occursOn(schedule: ProjectionSchedule, date: Date) {
  const day = clampDayOfMonth(schedule.dayOfMonth, date.getFullYear(), date.getMonth())
  return date.getDate() === day
}

/**
 * Avance le solde jour par jour.
 * Chaque jour futur retire le rythme variable et applique les récurrences
 * dont le jour tombe ce jour-là, sans rejouer une occurrence déjà écrite.
 */
function projectForward(input: ProjectionInput, dailySpendRate: number, horizonDays: number) {
  const posted = new Set(input.postedKeys)
  let balance = input.currentBalance
  const active = input.schedules.filter(
    (schedule) => schedule.active && schedule.type !== TransactionType.TRANSFER,
  )

  for (let offset = 1; offset <= horizonDays; offset += 1) {
    const date = addDays(input.now, offset)
    for (const schedule of active) {
      if (!occursOn(schedule, date)) continue
      const key = periodKey(schedule, date)
      if (posted.has(key)) continue
      balance += signedAmount(schedule)
      posted.add(key)
    }
    balance -= dailySpendRate
  }

  return round2(balance)
}

function isRemainingThisMonth(schedule: ProjectionSchedule, now: Date, posted: Set<string>) {
  if (!schedule.active || schedule.type === TransactionType.TRANSFER) return false
  const dueDay = clampDayOfMonth(schedule.dayOfMonth, now.getFullYear(), now.getMonth())
  if (dueDay <= now.getDate()) return false
  const due = atNoon(now.getFullYear(), now.getMonth(), dueDay)
  return !posted.has(periodKey(schedule, due))
}

export function buildFinancialProjections(input: ProjectionInput): FinancialProjections {
  const daysElapsed = Math.max(nowDay(input.now), 1)
  const monthLength = daysInMonth(input.now)
  const daysRemaining = Math.max(monthLength - daysElapsed, 0)
  const dailySpendRate = round2(input.variableExpenses / daysElapsed)

  const posted = new Set(input.postedKeys)
  let remainingRecurringExpenses = 0
  let remainingRecurringIncome = 0
  for (const schedule of input.schedules) {
    if (!isRemainingThisMonth(schedule, input.now, posted)) continue
    if (schedule.type === TransactionType.INCOME) remainingRecurringIncome += schedule.amount
    if (schedule.type === TransactionType.EXPENSE) remainingRecurringExpenses += schedule.amount
  }
  remainingRecurringExpenses = round2(remainingRecurringExpenses)
  remainingRecurringIncome = round2(remainingRecurringIncome)

  const endOfMonthBalance = round2(
    input.currentBalance +
      remainingRecurringIncome -
      remainingRecurringExpenses -
      dailySpendRate * daysRemaining,
  )

  const horizons: ProjectionPoint[] = PROJECTION_HORIZONS.map((horizonDays) => {
    const date = addDays(input.now, horizonDays)
    return {
      horizonDays,
      label: `+${horizonDays} j`,
      date: date.toISOString(),
      balance: projectForward(input, dailySpendRate, horizonDays),
    }
  })

  const crossesZero = [endOfMonthBalance, ...horizons.map((point) => point.balance)].some(
    (balance) => balance <= CRITICAL_BALANCE,
  )

  return {
    asOf: atNoon(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).toISOString(),
    currentBalance: round2(input.currentBalance),
    remainingRecurringExpenses,
    remainingRecurringIncome,
    variableExpenses: round2(input.variableExpenses),
    daysElapsed,
    daysRemaining,
    daysInMonth: monthLength,
    dailySpendRate,
    endOfMonthBalance,
    horizons,
    crossesZero,
    criticalThreshold: CRITICAL_BALANCE,
  }
}

function nowDay(now: Date) {
  return now.getDate()
}

/** Mois entiers nécessaires pour atteindre une cible à capacité constante. */
export function savingsPlan(target: number, monthlyCapacity: number, from = new Date()) {
  if (!Number.isFinite(target) || target <= 0) {
    return { months: 0, date: from.toISOString(), reachable: true }
  }
  if (!Number.isFinite(monthlyCapacity) || monthlyCapacity <= 0) {
    return { months: null, date: null, reachable: false }
  }
  const months = Math.ceil(target / monthlyCapacity)
  const date = atNoon(from.getFullYear(), from.getMonth() + months, from.getDate())
  return { months, date: date.toISOString(), reachable: true }
}
