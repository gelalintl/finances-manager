/** Bornes de mois/année, toutes en heure locale pour coller au ressenti utilisateur. */

export type Range = { start: Date; end: Date }

export function monthRange(reference = new Date()): Range {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1, 0, 0, 0, 0)
  return { start, end }
}

export function previousMonthRange(reference = new Date()): Range {
  return monthRange(new Date(reference.getFullYear(), reference.getMonth() - 1, 1))
}

export function yearRange(reference = new Date()): Range {
  const start = new Date(reference.getFullYear(), 0, 1, 0, 0, 0, 0)
  const end = new Date(reference.getFullYear() + 1, 0, 1, 0, 0, 0, 0)
  return { start, end }
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date).replace('.', '')
}

/** Les N derniers mois, du plus ancien au plus récent (N inclut le mois courant). */
export function lastMonths(count: number, reference = new Date()): Range[] {
  const ranges: Range[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    ranges.push(monthRange(new Date(reference.getFullYear(), reference.getMonth() - offset, 1)))
  }
  return ranges
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatLongDate(value: Date | string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

/** `yyyy-MM-dd` pour les `<input type="date">`. */
export function toDateInput(value: Date | string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

/** Parse une saisie `yyyy-MM-dd` en date locale (évite le décalage UTC). */
export function fromDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Borne un jour du mois à la longueur réelle du mois (31 → 28/30). */
export function clampDayOfMonth(day: number, year: number, month: number) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(Math.max(day, 1), lastDay)
}
