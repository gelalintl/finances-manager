export type SortDir = 'asc' | 'desc'

export const TRANSACTION_SORTS = ['date', 'description', 'category', 'account', 'type', 'amount'] as const

export type TransactionSort = (typeof TRANSACTION_SORTS)[number]

export function parseSortDir(value?: string | null, fallback: SortDir = 'asc'): SortDir {
  return value === 'desc' || value === 'asc' ? value : fallback
}

export function parseSortKey<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const key = String(value ?? '')
  return allowed.includes(key as T) ? (key as T) : fallback
}

export function compareText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', 'fr', { numeric: true, sensitivity: 'base' })
}

export function compareNumber(a: number, b: number) {
  return a - b
}

export function compareDate(a: string | Date | null | undefined, b: string | Date | null | undefined) {
  const left = a ? new Date(a).getTime() : 0
  const right = b ? new Date(b).getTime() : 0
  return left - right
}

export function sortBy<T>(
  rows: T[],
  dir: SortDir,
  compare: (left: T, right: T) => number,
): T[] {
  const factor = dir === 'desc' ? -1 : 1
  return [...rows].sort((left, right) => factor * compare(left, right))
}
