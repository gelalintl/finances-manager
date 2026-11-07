import { CategoryType } from '@prisma/client'
import { CATEGORY_ICON_NAMES } from '@/components/ui/category-icon'
import { parseAmount } from '@/lib/money'

/**
 * Registre des catégories par défaut.
 * `icon` référence une icône Lucide résolue par `<CategoryIcon />`.
 */
export type CategorySeed = {
  name: string
  type: CategoryType
  icon: string
  color: string
  budgetLimit: number | null
}

export const EXPENSE_CATEGORIES: CategorySeed[] = [
  { name: 'Alimentation', type: CategoryType.EXPENSE, icon: 'UtensilsCrossed', color: '#f97316', budgetLimit: 150_000 },
  { name: 'Transport', type: CategoryType.EXPENSE, icon: 'Car', color: '#0ea5e9', budgetLimit: 60_000 },
  { name: 'Logement', type: CategoryType.EXPENSE, icon: 'House', color: '#8b5cf6', budgetLimit: 250_000 },
  { name: 'Santé', type: CategoryType.EXPENSE, icon: 'HeartPulse', color: '#ef4444', budgetLimit: 50_000 },
  { name: 'Loisirs', type: CategoryType.EXPENSE, icon: 'Gamepad2', color: '#ec4899', budgetLimit: 75_000 },
  { name: 'Énergie & Eau', type: CategoryType.EXPENSE, icon: 'Zap', color: '#eab308', budgetLimit: 45_000 },
  { name: 'Téléphone & Internet', type: CategoryType.EXPENSE, icon: 'Smartphone', color: '#14b8a6', budgetLimit: 30_000 },
  { name: 'Éducation', type: CategoryType.EXPENSE, icon: 'GraduationCap', color: '#6366f1', budgetLimit: 80_000 },
  { name: 'Vêtements', type: CategoryType.EXPENSE, icon: 'Shirt', color: '#a855f7', budgetLimit: 40_000 },
  { name: 'Abonnements', type: CategoryType.EXPENSE, icon: 'Repeat', color: '#64748b', budgetLimit: 25_000 },
]

export const INCOME_CATEGORIES: CategorySeed[] = [
  { name: 'Salaire', type: CategoryType.INCOME, icon: 'Briefcase', color: '#10b981', budgetLimit: null },
  { name: 'Freelance', type: CategoryType.INCOME, icon: 'Laptop', color: '#22c55e', budgetLimit: null },
  { name: 'Primes', type: CategoryType.INCOME, icon: 'Gift', color: '#84cc16', budgetLimit: null },
  { name: 'Épargne & Intérêts', type: CategoryType.INCOME, icon: 'PiggyBank', color: '#06b6d4', budgetLimit: null },
]

export const DEFAULT_CATEGORIES: CategorySeed[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]

/** Palette proposée dans les formulaires de catégorie. */
export const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#10b981', '#22c55e',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#64748b',
] as const

export const categoryTypeLabels: Record<CategoryType, string> = {
  INCOME: 'Revenu',
  EXPENSE: 'Dépense',
}

export function parseCategoryType(value: unknown): CategoryType | null {
  if (value === CategoryType.INCOME || value === CategoryType.EXPENSE) return value
  return null
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const MAX_MONEY = 999_999_999_999.99

export function parseCategoryIcon(value: unknown): string | null {
  const name = String(value ?? '').trim()
  return CATEGORY_ICON_NAMES.includes(name) ? name : null
}

export function parseCategoryColor(value: unknown): string | null {
  const color = String(value ?? '').trim()
  return HEX_COLOR.test(color) ? color.toLowerCase() : null
}

/** Chaîne vide = catégorie non plafonnée. */
export function parseBudgetLimit(value: unknown): number | null | undefined {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const amount = parseAmount(raw)
  if (amount === null || amount < 0 || amount > MAX_MONEY) return undefined
  return amount
}

export type CategoryListItem = {
  publicId: string
  name: string
  type: CategoryType
  icon: string
  color: string
  budgetLimit: number | null
  isArchived: boolean
}
