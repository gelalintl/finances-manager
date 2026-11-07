import { round2 } from '@/lib/money'

/**
 * Garde-fous budgétaires (financial guardrails).
 * Fonctions pures : aucune dépendance à Prisma, donc testables isolément.
 */

export type BudgetTone = 'ok' | 'warning' | 'danger'

/** Vert < 70 % · Jaune 70-90 % · Rouge > 90 % (cf. cahier des charges). */
export const BUDGET_WARNING_RATIO = 70
export const BUDGET_DANGER_RATIO = 90

export function budgetTone(ratio: number): BudgetTone {
  if (ratio > BUDGET_DANGER_RATIO) return 'danger'
  if (ratio >= BUDGET_WARNING_RATIO) return 'warning'
  return 'ok'
}

export const budgetToneClasses: Record<BudgetTone, { bar: string; text: string; soft: string }> = {
  ok: { bar: 'bg-income', text: 'text-income', soft: 'bg-income/10' },
  warning: { bar: 'bg-warning', text: 'text-warning', soft: 'bg-warning/10' },
  danger: { bar: 'bg-expense', text: 'text-expense', soft: 'bg-expense/10' },
}

/**
 * Plafond mensuel applicable à une catégorie.
 * Un `BudgetGoal` explicite prime toujours sur le `budgetLimit` de la catégorie.
 */
export function resolveMonthlyLimit(
  categoryLimit: number | null | undefined,
  goalLimit: number | null | undefined,
): number | null {
  if (goalLimit !== null && goalLimit !== undefined && goalLimit > 0) return round2(goalLimit)
  if (categoryLimit !== null && categoryLimit !== undefined && categoryLimit > 0) {
    return round2(categoryLimit)
  }
  return null
}

export type BudgetGauge = {
  categoryPublicId: string
  name: string
  icon: string
  color: string
  limit: number
  spent: number
  remaining: number
  /** Pourcentage consommé, non borné (peut dépasser 100). */
  ratio: number
  /** Pourcentage borné à 100, pour la largeur de la barre. */
  width: number
  tone: BudgetTone
  alertThreshold: number
  alertReached: boolean
  exceeded: boolean
}

export function buildBudgetGauge(input: {
  categoryPublicId: string
  name: string
  icon: string
  color: string
  limit: number
  spent: number
  alertThreshold?: number
}): BudgetGauge {
  const limit = round2(input.limit)
  const spent = round2(input.spent)
  const ratio = limit > 0 ? round2((spent / limit) * 100) : 0
  const alertThreshold = input.alertThreshold ?? 80

  return {
    categoryPublicId: input.categoryPublicId,
    name: input.name,
    icon: input.icon,
    color: input.color,
    limit,
    spent,
    remaining: round2(limit - spent),
    ratio,
    width: Math.min(ratio, 100),
    tone: budgetTone(ratio),
    alertThreshold,
    alertReached: ratio >= alertThreshold,
    exceeded: spent > limit,
  }
}

/**
 * Vérifie si une dépense supplémentaire ferait franchir le plafond.
 * Appelé par `createTransaction` AVANT de répondre, la dépense étant
 * toujours enregistrée (on avertit, on ne bloque pas).
 */
export type BudgetCheck = {
  exceededBudget: boolean
  alertReached: boolean
  categoryName: string
  limit: number
  spent: number
  remaining: number
  ratio: number
  overBy: number
}

export function checkBudget(input: {
  categoryName: string
  limit: number | null
  spentBefore: number
  newAmount: number
  alertThreshold?: number
}): BudgetCheck | null {
  if (input.limit === null || input.limit <= 0) return null

  const limit = round2(input.limit)
  const spent = round2(input.spentBefore + input.newAmount)
  const ratio = round2((spent / limit) * 100)
  const alertThreshold = input.alertThreshold ?? 80

  return {
    exceededBudget: spent > limit,
    alertReached: ratio >= alertThreshold,
    categoryName: input.categoryName,
    limit,
    spent,
    remaining: round2(limit - spent),
    ratio,
    overBy: round2(Math.max(spent - limit, 0)),
  }
}

/**
 * Reste à Vivre mensuel :
 *   (Total Revenus) − (Total Charges Fixes) − (Total Dépenses Variables)
 *
 * La distinction charge fixe / dépense variable s'appuie sur le drapeau
 * `isRecurring` de la transaction : une dépense récurrente (loyer, abonnement,
 * prélèvement) est une charge fixe ; toute autre dépense est variable.
 */
export type DisposableIncome = {
  income: number
  fixedCharges: number
  variableExpenses: number
  totalExpenses: number
  disposable: number
  /** Part du revenu encore disponible, bornée à [0, 100]. */
  savingsRate: number
}

export function computeDisposableIncome(input: {
  income: number
  fixedCharges: number
  variableExpenses: number
}): DisposableIncome {
  const income = round2(input.income)
  const fixedCharges = round2(input.fixedCharges)
  const variableExpenses = round2(input.variableExpenses)
  const disposable = round2(income - fixedCharges - variableExpenses)

  return {
    income,
    fixedCharges,
    variableExpenses,
    totalExpenses: round2(fixedCharges + variableExpenses),
    disposable,
    savingsRate: income > 0 ? Math.max(0, Math.min(100, round2((disposable / income) * 100))) : 0,
  }
}
