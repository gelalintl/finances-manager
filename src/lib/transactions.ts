import { PaymentMethod, TransactionType } from '@prisma/client'

export const transactionTypeLabels: Record<TransactionType, string> = {
  INCOME: 'Revenu',
  EXPENSE: 'Dépense',
  TRANSFER: 'Virement',
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement bancaire',
  MOBILE_MONEY: 'Mobile Money',
  CHECK: 'Chèque',
  DIRECT_DEBIT: 'Prélèvement',
}

export function parseTransactionType(value: unknown): TransactionType {
  const key = String(value ?? '')
  return (Object.keys(transactionTypeLabels) as TransactionType[]).includes(key as TransactionType)
    ? (key as TransactionType)
    : TransactionType.EXPENSE
}

export function parsePaymentMethod(value: unknown): PaymentMethod {
  const key = String(value ?? '')
  return (Object.keys(paymentMethodLabels) as PaymentMethod[]).includes(key as PaymentMethod)
    ? (key as PaymentMethod)
    : PaymentMethod.CASH
}

/** Type de transaction utilisé comme filtre de liste (`all` = pas de filtre). */
export type TransactionTypeFilter = TransactionType | 'all'

export function parseTypeFilter(value: unknown): TransactionTypeFilter {
  const key = String(value ?? '')
  if (key === 'all' || !key) return 'all'
  return (Object.keys(transactionTypeLabels) as TransactionType[]).includes(key as TransactionType)
    ? (key as TransactionType)
    : 'all'
}

/** Ligne de transaction sérialisable (Decimal déjà converti en number). */
export type TransactionListItem = {
  publicId: string
  type: TransactionType
  amount: number
  date: string
  description: string | null
  paymentMethod: PaymentMethod
  isRecurring: boolean
  category: {
    publicId: string
    name: string
    icon: string
    color: string
  } | null
  account: {
    publicId: string
    name: string
  }
  toAccount: {
    publicId: string
    name: string
  } | null
}

export type TransactionFilters = {
  type?: string
  categoryId?: string
  accountId?: string
  from?: string
  to?: string
  q?: string
  sort?: string
  dir?: string
}

/** Signe affiché : un virement est neutre sur le patrimoine global. */
export function signedAmount(type: TransactionType, amount: number) {
  if (type === TransactionType.INCOME) return amount
  if (type === TransactionType.EXPENSE) return -amount
  return 0
}

export const typeToneClasses: Record<TransactionType, string> = {
  INCOME: 'text-income',
  EXPENSE: 'text-expense',
  TRANSFER: 'text-transfer',
}
