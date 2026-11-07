import { DebtStatus, DebtType } from '@prisma/client'
import { round2 } from '@/lib/money'

export const debtTypeLabels: Record<DebtType, string> = {
  DEBT: 'Dette',
  LENT: 'Prêt accordé',
}

export const debtStatusLabels: Record<DebtStatus, string> = {
  PENDING: 'En attente',
  PARTIAL: 'Partiel',
  PAID: 'Soldé',
}

export type DebtListItem = {
  publicId: string
  type: DebtType
  personName: string
  totalAmount: number
  remainingAmount: number
  paidAmount: number
  progress: number
  dueDate: string | null
  status: DebtStatus
  notes: string | null
}

export type DebtAccountOption = {
  publicId: string
  name: string
}

export function parseDebtType(value: unknown): DebtType | null {
  if (value === DebtType.DEBT || value === DebtType.LENT) return value
  return null
}

/** Part déjà remboursée, bornée à 100. */
export function debtProgress(totalAmount: number, remainingAmount: number) {
  if (totalAmount <= 0) return 0
  const paid = Math.max(totalAmount - remainingAmount, 0)
  return Math.min(100, Math.max(0, round2((paid / totalAmount) * 100)))
}

export function isDebtOpen(status: DebtStatus) {
  return status !== DebtStatus.PAID
}
