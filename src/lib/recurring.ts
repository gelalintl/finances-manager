import { CategoryType, Frequency, TransactionType } from '@prisma/client'
import { clampDayOfMonth, monthRange, yearRange, type Range } from '@/lib/dates'

export const frequencyLabels: Record<Frequency, string> = {
  MONTHLY: 'Mensuel',
  YEARLY: 'Annuel',
}

export const RECURRING_SORTS = ['label', 'amount', 'frequency', 'dayOfMonth', 'category'] as const

export type RecurringSort = (typeof RECURRING_SORTS)[number]

export function parseFrequency(value: unknown): Frequency | null {
  if (value === Frequency.MONTHLY || value === Frequency.YEARLY) return value
  return null
}

/** Revenu ou dépense : une récurrence n'a pas de compte destinataire. */
export function parseRecurringType(value: unknown): TransactionType | null {
  if (value === TransactionType.INCOME || value === TransactionType.EXPENSE) return value
  return null
}

export function parseDayOfMonth(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isInteger(raw) || raw < 1 || raw > 31) return null
  return raw
}

/** Mois civil pour un mensuel, année civile pour un annuel. */
export function recurringPeriod(frequency: Frequency, now = new Date()): Range {
  return frequency === Frequency.YEARLY ? yearRange(now) : monthRange(now)
}

/**
 * Échéance due : le jour du mois est atteint (ou dépassé) dans le mois en cours.
 * Un annuel n'est posté qu'une fois par année, mais daté dans le mois de génération.
 */
export function isRecurringDue(dayOfMonth: number, now = new Date()) {
  return dayOfMonth <= now.getDate()
}

/** Date de l'écriture dans le mois en cours, bornée à la longueur réelle du mois. */
export function occurrenceDate(dayOfMonth: number, now = new Date()) {
  const day = clampDayOfMonth(dayOfMonth, now.getFullYear(), now.getMonth())
  return new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0, 0)
}

export function periodStatusLabel(frequency: Frequency, posted: boolean) {
  if (frequency === Frequency.YEARLY) {
    return posted ? 'Générée cette année' : 'À générer cette année'
  }
  return posted ? 'Générée ce mois' : 'À générer ce mois'
}

export type RecurringListItem = {
  publicId: string
  label: string
  type: TransactionType
  amount: number
  frequency: Frequency
  dayOfMonth: number
  active: boolean
  lastRunAt: string | null
  postedThisPeriod: boolean
  category: {
    publicId: string
    name: string
    icon: string
    color: string
    type: CategoryType
  } | null
  account: {
    publicId: string
    name: string
  }
}
