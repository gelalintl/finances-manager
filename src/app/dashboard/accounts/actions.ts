'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserContext } from '@/lib/user-context'
import { accountBalance, parseAccountType, type AccountListItem } from '@/lib/accounts'
import { parseAmount, round2, toNumber } from '@/lib/money'
import { paginationMeta, parseLimit, parsePage, type Paginated } from '@/lib/pagination'

const ACCOUNTS_PATH = '/dashboard/accounts'
const MAX_MONEY = 999_999_999_999.99

type MutationResult = { ok: true } | { ok: false; error: string }

function revalidateAccounts() {
  revalidatePath(ACCOUNTS_PATH)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard/recurring')
}

function readName(value: unknown) {
  const name = String(value ?? '').trim()
  if (!name || name.length > 80) return null
  return name
}

function readInitialBalance(value: unknown) {
  const amount = parseAmount(value)
  if (amount === null || Math.abs(amount) > MAX_MONEY) return null
  return amount
}

function readInstitution(value: unknown): string | null | undefined {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (raw.length > 80) return undefined
  return raw
}

function mutationError(error: unknown, duplicate: string, fallback: string): MutationResult {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return { ok: false, error: duplicate }
  }
  console.error(fallback, error)
  return { ok: false, error: fallback }
}

export async function getAccounts(
  page: number,
  limit: number,
  archived = false,
): Promise<Paginated<AccountListItem>> {
  const empty: Paginated<AccountListItem> = {
    data: [],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
  }

  const ctx = await getUserContext()
  if (!ctx.ok) return empty

  const where = { userId: ctx.user.id, isArchived: archived }
  const totalCount = await prisma.account.count({ where })
  const meta = paginationMeta(totalCount, parsePage(page), parseLimit(limit))

  const rows = await prisma.account.findMany({
    where,
    orderBy: { name: 'asc' },
    skip: meta.skip,
    take: meta.take,
    select: {
      id: true,
      publicId: true,
      name: true,
      type: true,
      institution: true,
      balance: true,
      isArchived: true,
    },
  })

  const ids = rows.map((row) => row.id)
  const movementRows =
    ids.length === 0
      ? []
      : await prisma.transaction.findMany({
          where: {
            userId: ctx.user.id,
            OR: [{ accountId: { in: ids } }, { toAccountId: { in: ids } }],
          },
          select: { type: true, amount: true, accountId: true, toAccountId: true },
        })

  const movements = movementRows.map((row) => ({
    type: row.type,
    amount: toNumber(row.amount),
    accountId: row.accountId,
    toAccountId: row.toAccountId,
  }))

  return {
    data: rows.map((row) => {
      const initialBalance = toNumber(row.balance)
      return {
        publicId: row.publicId,
        name: row.name,
        type: row.type,
        institution: row.institution,
        initialBalance,
        balance: round2(accountBalance(row.id, initialBalance, movements)),
        isArchived: row.isArchived,
      }
    }),
    totalCount: meta.totalCount,
    totalPages: meta.totalPages,
    currentPage: meta.currentPage,
  }
}

export async function createAccount(formData: FormData): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const name = readName(formData.get('name'))
  const type = parseAccountType(formData.get('type'))
  const balance = readInitialBalance(formData.get('balance'))
  const institution = readInstitution(formData.get('institution'))

  if (!name) return { ok: false, error: 'Indiquez un nom de compte (80 caractères maximum).' }
  if (!type) return { ok: false, error: 'Choisissez un type de compte.' }
  if (balance === null) return { ok: false, error: 'Indiquez un solde initial valide.' }
  if (institution === undefined) return { ok: false, error: "Le nom de l'établissement est trop long." }

  try {
    await prisma.account.create({
      data: {
        userId: ctx.user.id,
        name,
        type,
        balance,
        institution,
      },
    })
  } catch (error) {
    return mutationError(error, 'Un compte portant ce nom existe déjà.', 'La création du compte a échoué.')
  }

  revalidateAccounts()
  return { ok: true }
}

export async function updateAccount(formData: FormData): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const publicId = String(formData.get('publicId') ?? '')
  const name = readName(formData.get('name'))
  const type = parseAccountType(formData.get('type'))
  const balance = readInitialBalance(formData.get('balance'))
  const institution = readInstitution(formData.get('institution'))

  if (!publicId) return { ok: false, error: 'Compte introuvable.' }
  if (!name) return { ok: false, error: 'Indiquez un nom de compte (80 caractères maximum).' }
  if (!type) return { ok: false, error: 'Choisissez un type de compte.' }
  if (balance === null) return { ok: false, error: 'Indiquez un solde initial valide.' }
  if (institution === undefined) return { ok: false, error: "Le nom de l'établissement est trop long." }

  const account = await prisma.account.findFirst({
    where: { publicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!account) return { ok: false, error: 'Compte introuvable.' }

  try {
    await prisma.account.update({
      where: { id: account.id },
      data: { name, type, balance, institution },
    })
  } catch (error) {
    return mutationError(error, 'Un compte portant ce nom existe déjà.', 'La mise à jour du compte a échoué.')
  }

  revalidateAccounts()
  return { ok: true }
}

export async function setAccountArchived(publicId: string, archived: boolean): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const account = await prisma.account.findFirst({
    where: { publicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!account) return { ok: false, error: 'Compte introuvable.' }

  await prisma.account.update({
    where: { id: account.id },
    data: { isArchived: archived },
  })

  revalidateAccounts()
  return { ok: true }
}

export async function deleteAccount(publicId: string): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const account = await prisma.account.findFirst({
    where: { publicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!account) return { ok: false, error: 'Compte introuvable.' }

  try {
    await prisma.account.delete({ where: { id: account.id } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return {
        ok: false,
        error: 'Ce compte est lié à des transactions ou des échéances. Archivez-le pour le retirer des listes.',
      }
    }
    console.error('Erreur suppression compte:', error)
    return { ok: false, error: 'La suppression du compte a échoué.' }
  }

  revalidateAccounts()
  return { ok: true }
}
