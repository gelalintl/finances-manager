import { AccountType, TransactionType } from '@prisma/client'

export const accountTypeLabels: Record<AccountType, string> = {
  CHECKING: 'Compte courant',
  SAVINGS: 'Épargne',
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte prépayée',
}

/** Famille affichée sur les cartes : Banque, Cash ou Mobile Money. */
export const accountFamilyLabels: Record<AccountType, string> = {
  CHECKING: 'Banque',
  SAVINGS: 'Banque',
  CARD: 'Banque',
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile Money',
}

export const accountTypeIcons: Record<AccountType, string> = {
  CHECKING: 'Landmark',
  SAVINGS: 'PiggyBank',
  CASH: 'Banknote',
  MOBILE_MONEY: 'Smartphone',
  CARD: 'CreditCard',
}

export function parseAccountType(value: unknown): AccountType | null {
  const key = String(value ?? '')
  return (Object.keys(accountTypeLabels) as AccountType[]).includes(key as AccountType)
    ? (key as AccountType)
    : null
}

/** Valeur du select « Compte » qui ouvre la création rapide. */
export const NEW_ACCOUNT_OPTION = '__new__'

/** Types proposés dans la saisie rapide, sans quitter la modale de transaction. */
export const QUICK_ACCOUNT_TYPES = [
  AccountType.CHECKING,
  AccountType.SAVINGS,
  AccountType.CASH,
  AccountType.MOBILE_MONEY,
] as const

export function parseQuickAccountType(value: unknown): AccountType | null {
  const type = parseAccountType(value)
  if (!type || !(QUICK_ACCOUNT_TYPES as readonly AccountType[]).includes(type)) return null
  return type
}

/** Ligne de compte sérialisable : le solde courant est déjà calculé. */
export type AccountListItem = {
  publicId: string
  name: string
  type: AccountType
  institution: string | null
  /** Solde d'ouverture stocké sur le compte. */
  initialBalance: number
  /** Solde courant = solde initial + journal. */
  balance: number
  isArchived: boolean
}

export type AccountMovement = {
  type: TransactionType
  amount: number
  accountId: number
  toAccountId: number | null
}

/**
 * Solde courant d'un compte = solde initial + journal des transactions.
 *
 * Règles de signe :
 *  - INCOME   : crédite `accountId`
 *  - EXPENSE  : débite  `accountId`
 *  - TRANSFER : débite  `accountId` et crédite `toAccountId`
 */
export function accountBalance(
  accountId: number,
  initialBalance: number,
  movements: AccountMovement[],
) {
  return movements.reduce((balance, movement) => {
    if (movement.type === TransactionType.INCOME && movement.accountId === accountId) {
      return balance + movement.amount
    }
    if (movement.type === TransactionType.EXPENSE && movement.accountId === accountId) {
      return balance - movement.amount
    }
    if (movement.type === TransactionType.TRANSFER) {
      if (movement.accountId === accountId) return balance - movement.amount
      if (movement.toAccountId === accountId) return balance + movement.amount
    }
    return balance
  }, initialBalance)
}

/**
 * Impact net d'un lot de transactions sur la trésorerie globale.
 * Les virements internes sont neutres : ils ne changent pas le patrimoine.
 */
export function netCashImpact(movements: AccountMovement[]) {
  return movements.reduce((total, movement) => {
    if (movement.type === TransactionType.INCOME) return total + movement.amount
    if (movement.type === TransactionType.EXPENSE) return total - movement.amount
    return total
  }, 0)
}
