'use server'

import { revalidatePath } from 'next/cache'
import { AccountType, DebtStatus, DebtType, PaymentMethod, Prisma, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserContext, requireUser } from '@/lib/user-context'
import { fromDateInput } from '@/lib/dates'
import { parseAmount, round2, toNumber } from '@/lib/money'
import {
  debtProgress,
  parseDebtType,
  type DebtAccountOption,
  type DebtListItem,
} from '@/lib/debts'

const MAX_MONEY = 999_999_999_999.99

type MutationResult = { ok: true } | { ok: false; error: string }

function revalidateDebts() {
  revalidatePath('/dashboard/debts')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard/reports')
  revalidatePath('/dashboard/projections')
}

function paymentFor(type: TransactionType, accountType: AccountType): PaymentMethod {
  if (accountType === AccountType.CASH) return PaymentMethod.CASH
  if (accountType === AccountType.MOBILE_MONEY) return PaymentMethod.MOBILE_MONEY
  if (accountType === AccountType.CARD) return PaymentMethod.CARD
  return type === TransactionType.INCOME ? PaymentMethod.BANK_TRANSFER : PaymentMethod.DIRECT_DEBIT
}

function readPersonName(value: unknown) {
  const name = String(value ?? '').trim()
  if (!name || name.length > 80) return null
  return name
}

function readMoney(value: unknown) {
  const amount = parseAmount(value)
  if (amount === null || amount <= 0 || amount > MAX_MONEY) return null
  return amount
}

function readNotes(value: unknown) {
  const notes = String(value ?? '').trim()
  if (!notes) return null
  if (notes.length > 2000) return undefined
  return notes
}

export async function getDebtWorkspace(): Promise<{
  debts: DebtListItem[]
  accounts: DebtAccountOption[]
}> {
  const user = await requireUser()

  const [debts, accounts] = await Promise.all([
    prisma.debt.findMany({
      where: { userId: user.id },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { personName: 'asc' }],
      select: {
        publicId: true,
        type: true,
        personName: true,
        totalAmount: true,
        remainingAmount: true,
        dueDate: true,
        status: true,
        notes: true,
      },
    }),
    prisma.account.findMany({
      where: { userId: user.id, isArchived: false },
      orderBy: { name: 'asc' },
      select: { publicId: true, name: true },
    }),
  ])

  return {
    accounts,
    debts: debts.map((debt) => {
      const totalAmount = toNumber(debt.totalAmount)
      const remainingAmount = toNumber(debt.remainingAmount)
      return {
        publicId: debt.publicId,
        type: debt.type,
        personName: debt.personName,
        totalAmount,
        remainingAmount,
        paidAmount: round2(Math.max(totalAmount - remainingAmount, 0)),
        progress: debtProgress(totalAmount, remainingAmount),
        dueDate: debt.dueDate ? debt.dueDate.toISOString() : null,
        status: debt.status,
        notes: debt.notes,
      }
    }),
  }
}

/**
 * Enregistre une dette ou un prêt.
 * Un prêt accordé peut débiter le compte choisi : l'argent sort au moment du prêt.
 */
export async function createDebt(formData: FormData): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const type = parseDebtType(formData.get('type'))
  const personName = readPersonName(formData.get('personName'))
  const totalAmount = readMoney(formData.get('totalAmount'))
  const notes = readNotes(formData.get('notes'))
  const dueRaw = String(formData.get('dueDate') ?? '').trim()
  const dueDate = dueRaw ? fromDateInput(dueRaw) : null
  const debitNow = String(formData.get('debitNow') ?? '') === 'true'

  if (!type) return { ok: false, error: 'Choisissez une dette ou un prêt.' }
  if (!personName) return { ok: false, error: 'Indiquez le nom de la personne.' }
  if (totalAmount === null) return { ok: false, error: 'Le montant doit être supérieur à 0.' }
  if (notes === undefined) return { ok: false, error: 'La note ne peut pas dépasser 2 000 caractères.' }
  if (dueRaw && !dueDate) return { ok: false, error: 'La date d’échéance est invalide.' }
  if (debitNow && type !== DebtType.LENT) {
    return { ok: false, error: 'Seul un prêt accordé peut débiter un compte à la création.' }
  }

  let account: { id: number; type: AccountType } | null = null
  if (debitNow) {
    account = await prisma.account.findFirst({
      where: { publicId: String(formData.get('accountId') ?? ''), userId: ctx.user.id, isArchived: false },
      select: { id: true, type: true },
    })
    if (!account) return { ok: false, error: 'Choisissez le compte à débiter.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.debt.create({
        data: {
          userId: ctx.user.id,
          type,
          personName,
          totalAmount,
          remainingAmount: totalAmount,
          dueDate,
          status: DebtStatus.PENDING,
          notes,
        },
      })

      if (account) {
        const now = new Date()
        await tx.transaction.create({
          data: {
            userId: ctx.user.id,
            type: TransactionType.EXPENSE,
            amount: totalAmount,
            date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0),
            description: `Prêt accordé à ${personName}`,
            accountId: account.id,
            paymentMethod: paymentFor(TransactionType.EXPENSE, account.type),
          },
        })
      }
    })
  } catch (error) {
    console.error('createDebt', error)
    return { ok: false, error: 'Impossible d’enregistrer le dossier.' }
  }

  revalidateDebts()
  return { ok: true }
}

/**
 * Remboursement partiel ou total.
 * Une dette due sort du compte (dépense). Une créance rentre sur le compte (revenu).
 */
export async function recordDebtPayment(formData: FormData): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const amount = readMoney(formData.get('amount'))
  const date = fromDateInput(String(formData.get('date') ?? ''))
  if (amount === null) return { ok: false, error: 'Le montant doit être supérieur à 0.' }
  if (!date) return { ok: false, error: 'La date du remboursement est invalide.' }

  const account = await prisma.account.findFirst({
    where: { publicId: String(formData.get('accountId') ?? ''), userId: ctx.user.id, isArchived: false },
    select: { id: true, type: true },
  })
  if (!account) return { ok: false, error: 'Choisissez le compte du mouvement.' }

  const debtRef = await prisma.debt.findFirst({
    where: { publicId: String(formData.get('debtId') ?? ''), userId: ctx.user.id },
    select: { id: true },
  })
  if (!debtRef) return { ok: false, error: 'Dossier introuvable.' }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${debtRef.id}::integer, 2)`

      const debt = await tx.debt.findFirst({
        where: { id: debtRef.id, userId: ctx.user.id },
        select: {
          id: true,
          type: true,
          personName: true,
          remainingAmount: true,
          status: true,
        },
      })
      if (!debt) throw new Error('missing')
      if (debt.status === DebtStatus.PAID) throw new Error('paid')

      const remaining = toNumber(debt.remainingAmount)
      if (amount > remaining) throw new Error('exceeds')

      const nextRemaining = round2(remaining - amount)
      const status = nextRemaining <= 0 ? DebtStatus.PAID : DebtStatus.PARTIAL
      const movement =
        debt.type === DebtType.DEBT ? TransactionType.EXPENSE : TransactionType.INCOME

      await tx.debtPayment.create({
        data: {
          debtId: debt.id,
          amount,
          date,
          accountId: account.id,
        },
      })
      await tx.debt.update({
        where: { id: debt.id },
        data: {
          remainingAmount: nextRemaining,
          status,
        },
      })
      await tx.transaction.create({
        data: {
          userId: ctx.user.id,
          type: movement,
          amount,
          date,
          description:
            movement === TransactionType.EXPENSE
              ? `Remboursement à ${debt.personName}`
              : `Remboursement reçu de ${debt.personName}`,
          accountId: account.id,
          paymentMethod: paymentFor(movement, account.type),
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'paid') {
      return { ok: false, error: 'Ce dossier est déjà soldé.' }
    }
    if (error instanceof Error && error.message === 'exceeds') {
      return { ok: false, error: 'Le montant dépasse le reste dû.' }
    }
    if (error instanceof Error && error.message === 'missing') {
      return { ok: false, error: 'Dossier introuvable.' }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('recordDebtPayment', error)
    } else {
      console.error('recordDebtPayment', error)
    }
    return { ok: false, error: 'Impossible d’enregistrer le remboursement.' }
  }

  revalidateDebts()
  return { ok: true }
}
