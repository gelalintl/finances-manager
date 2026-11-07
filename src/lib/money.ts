import type { Prisma } from '@prisma/client'

export const DEFAULT_CURRENCY = 'FCFA'

/**
 * Prisma renvoie des `Decimal` (Decimal.js) qui ne sont pas sérialisables
 * vers les composants clients. Toute donnée qui traverse la frontière
 * serveur → client doit passer par ce convertisseur.
 */
export function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(value.toString())
  return Number.isFinite(parsed) ? parsed : 0
}

/** Arrondi à 2 décimales pour éviter les dérives de virgule flottante. */
export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function formatMoney(amount: number, currency = DEFAULT_CURRENCY) {
  const rounded = round2(amount)
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
  }).format(rounded)
  return `${formatted} ${currency}`
}

/** Montant signé lisible : « +125 000 FCFA » / « −40 000 FCFA ». */
export function formatSigned(amount: number, currency = DEFAULT_CURRENCY) {
  const sign = amount > 0 ? '+' : amount < 0 ? '\u2212' : ''
  return `${sign}${formatMoney(Math.abs(amount), currency)}`
}

export function formatCompact(amount: number, currency = DEFAULT_CURRENCY) {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `${round2(amount / 1_000_000)} M ${currency}`
  if (abs >= 1_000) return `${Math.round(amount / 1_000)} k ${currency}`
  return formatMoney(amount, currency)
}

export function formatPercent(value: number, fractionDigits = 0) {
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)} %`
}

/**
 * Variation en pourcentage entre deux périodes.
 * Renvoie `null` quand la période de référence est nulle : afficher « — »
 * est plus honnête qu'une croissance de +100 % partant de zéro.
 */
export function evolution(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return round2(((current - previous) / Math.abs(previous)) * 100)
}

export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? round2(value) : null
  const raw = String(value ?? '')
    .replace(/\s/g, '')
    .replace(',', '.')
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return round2(parsed)
}
