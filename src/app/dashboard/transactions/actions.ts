'use server'

import { revalidatePath } from 'next/cache'
import { AccountType, CategoryType, Prisma, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserContext } from '@/lib/user-context'
import { checkBudget, resolveMonthlyLimit, type BudgetCheck } from '@/lib/budget'
import { fromDateInput, monthRange } from '@/lib/dates'
import { parseAmount, round2, toNumber } from '@/lib/money'
import { paginationMeta, parseLimit, parsePage, type Paginated } from '@/lib/pagination'
import {
  parsePaymentMethod,
  parseTransactionType,
  parseTypeFilter,
  type TransactionFilters,
  type TransactionListItem,
} from '@/lib/transactions'
import { parseSortDir, parseSortKey, TRANSACTION_SORTS } from '@/lib/table-sort'
import { NEW_ACCOUNT_OPTION, parseQuickAccountType } from '@/lib/accounts'

const TRANSACTIONS_PATH = '/dashboard/transactions'
const DASHBOARD_PATH = '/dashboard'
const ACCOUNTS_PATH = '/dashboard/accounts'

function revalidateTransactions() {
  revalidatePath(TRANSACTIONS_PATH)
  revalidatePath(DASHBOARD_PATH)
  revalidatePath(ACCOUNTS_PATH)
}

export type CreateTransactionResult =
  | {
      ok: true
      /** Garde-fou : la dépense est enregistrée, mais le plafond est dépassé. */
      exceededBudget: boolean
      budget: BudgetCheck | null
      /** Compte source effectivement utilisé (y compris un compte créé à la volée). */
      accountPublicId: string
    }
  | { ok: false; error: string }

type MutationResult = { ok: true } | { ok: false; error: string }

/**
 * Enregistre une transaction.
 *
 * Garde-fou budgétaire : pour une dépense rattachée à une catégorie plafonnée,
 * l'écriture est TOUJOURS persistée, mais la réponse signale le dépassement
 * (`exceededBudget`) et l'atteinte du seuil d'alerte afin que l'UI avertisse
 * l'utilisateur sans bloquer sa saisie.
 */
export async function createTransaction(formData: FormData): Promise<CreateTransactionResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }
  return saveTransaction(formData, ctx.user.id, null)
}

/** Met à jour une écriture déjà présente dans le journal. */
export async function updateTransaction(formData: FormData): Promise<CreateTransactionResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const existing = await prisma.transaction.findFirst({
    where: { publicId: String(formData.get('publicId') ?? ''), userId: ctx.user.id },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: 'Transaction introuvable.' }

  return saveTransaction(formData, ctx.user.id, existing.id)
}

async function saveTransaction(
  formData: FormData,
  userId: number,
  existingId: number | null,
): Promise<CreateTransactionResult> {

  const type = parseTransactionType(formData.get('type'))
  const amount = parseAmount(formData.get('amount'))
  const paymentMethod = parsePaymentMethod(formData.get('paymentMethod'))
  const description = String(formData.get('description') ?? '').trim() || null
  const isRecurring = String(formData.get('isRecurring') ?? '') === 'true'

  if (amount === null || amount <= 0) {
    return { ok: false, error: 'Le montant doit être supérieur à 0.' }
  }

  const date = fromDateInput(String(formData.get('date') ?? '')) ?? new Date()

  // --- Compte source, ou création rapide dans la même transaction ---
  const accountPublicId = String(formData.get('accountId') ?? '')
  const creatingAccount = accountPublicId === NEW_ACCOUNT_OPTION
  const newAccountName = String(formData.get('newAccountName') ?? '').trim()
  const newAccountType = parseQuickAccountType(formData.get('newAccountType'))

  if (creatingAccount) {
    if (!newAccountName || newAccountName.length > 80) {
      return { ok: false, error: 'Indiquez un nom de compte (80 caractères maximum).' }
    }
    if (!newAccountType) return { ok: false, error: 'Choisissez un type de compte.' }
  }

  const account = creatingAccount
    ? null
    : await prisma.account.findFirst({
        where: { publicId: accountPublicId, userId, isArchived: false },
        select: { id: true },
      })
  if (!creatingAccount && !account) return { ok: false, error: 'Compte source introuvable.' }

  // --- Compte destinataire (virements uniquement) ---
  let toAccountId: number | null = null
  if (type === TransactionType.TRANSFER) {
    const toPublicId = String(formData.get('toAccountId') ?? '')
    const toAccount = await prisma.account.findFirst({
      where: { publicId: toPublicId, userId },
      select: { id: true },
    })
    if (!toAccount) return { ok: false, error: 'Compte destinataire introuvable.' }
    if (account && toAccount.id === account.id) {
      return { ok: false, error: 'Les comptes source et destinataire doivent être différents.' }
    }
    toAccountId = toAccount.id
  }

  // --- Catégorie (obligatoire hors virement) ---
  let category: {
    id: number
    name: string
    type: CategoryType
    budgetLimit: Prisma.Decimal | null
  } | null = null

  if (type !== TransactionType.TRANSFER) {
    const categoryPublicId = String(formData.get('categoryId') ?? '')
    category = await prisma.category.findFirst({
      where: { publicId: categoryPublicId, userId },
      select: { id: true, name: true, type: true, budgetLimit: true },
    })
    if (!category) return { ok: false, error: 'Catégorie introuvable.' }

    const expectedType = type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE
    if (category.type !== expectedType) {
      return {
        ok: false,
        error: `La catégorie « ${category.name} » ne correspond pas à une ${
          type === TransactionType.INCOME ? 'recette' : 'dépense'
        }.`,
      }
    }
  }

  let sourcePublicId = accountPublicId
  try {
    await prisma.$transaction(async (tx) => {
      let sourceId = account?.id
      if (creatingAccount && newAccountType) {
        const created = await tx.account.create({
          data: {
            userId,
            name: newAccountName,
            type: newAccountType,
            balance: 0,
          },
          select: { id: true, publicId: true },
        })
        sourceId = created.id
        sourcePublicId = created.publicId
      }
      if (!sourceId) throw new Error('missing-account')
      if (toAccountId !== null && toAccountId === sourceId) {
        throw new Error('same-account')
      }

      let recurringTransactionId: number | null = null
      if (isRecurring && category && type !== TransactionType.TRANSFER) {
        const match = await tx.recurringTransaction.findFirst({
          where: { userId, categoryId: category.id, type, active: true },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        })
        recurringTransactionId = match?.id ?? null
      }

      const data = {
        userId,
        type,
        amount,
        date,
        description,
        categoryId: category?.id ?? null,
        accountId: sourceId,
        toAccountId,
        paymentMethod,
        isRecurring,
        recurringTransactionId,
      }
      if (existingId === null) {
        await tx.transaction.create({ data })
      } else {
        await tx.transaction.update({ where: { id: existingId }, data })
      }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'Un compte portant ce nom existe déjà.' }
    }
    if (error instanceof Error && error.message === 'same-account') {
      return { ok: false, error: 'Les comptes source et destinataire doivent être différents.' }
    }
    console.error('Erreur enregistrement transaction:', error)
    return { ok: false, error: "L'enregistrement de la transaction a échoué." }
  }

  revalidateTransactions()

  // --- Garde-fou budgétaire ---
  const budget =
    type === TransactionType.EXPENSE && category
      ? await evaluateBudget(userId, category, date, amount)
      : null

  return {
    ok: true,
    exceededBudget: budget?.exceededBudget ?? false,
    budget,
    accountPublicId: sourcePublicId,
  }
}

/**
 * Compare le cumul des dépenses du mois de la transaction au plafond applicable
 * (BudgetGoal prioritaire, sinon `Category.budgetLimit`).
 */
async function evaluateBudget(
  userId: number,
  category: { id: number; name: string; budgetLimit: Prisma.Decimal | null },
  date: Date,
  newAmount: number,
): Promise<BudgetCheck | null> {
  const goal = await prisma.budgetGoal.findFirst({
    where: { userId, categoryId: category.id, period: 'MONTH' },
    select: { monthlyLimit: true, alertThreshold: true },
  })

  const limit = resolveMonthlyLimit(
    toNumber(category.budgetLimit) || null,
    goal ? toNumber(goal.monthlyLimit) : null,
  )
  if (limit === null) return null

  const range = monthRange(date)
  const aggregate = await prisma.transaction.aggregate({
    where: {
      userId,
      categoryId: category.id,
      type: TransactionType.EXPENSE,
      date: { gte: range.start, lt: range.end },
    },
    _sum: { amount: true },
  })

  // La nouvelle écriture est déjà persistée : on retire son montant
  // pour obtenir le cumul « avant » attendu par `checkBudget`.
  const spentAfter = toNumber(aggregate._sum.amount)
  const spentBefore = round2(Math.max(spentAfter - newAmount, 0))

  return checkBudget({
    categoryName: category.name,
    limit,
    spentBefore,
    newAmount,
    alertThreshold: goal?.alertThreshold ?? 80,
  })
}

export async function deleteTransaction(publicId: string): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const transaction = await prisma.transaction.findFirst({
    where: { publicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!transaction) return { ok: false, error: 'Transaction introuvable.' }

  await prisma.transaction.delete({ where: { id: transaction.id } })

  revalidatePath(TRANSACTIONS_PATH)
  revalidatePath(DASHBOARD_PATH)
  return { ok: true }
}

export type TransactionTotals = {
  income: number
  expense: number
  net: number
}

export type TransactionTotalsByAccount = Record<string, TransactionTotals>

type FlowRow = { accountId: number; type: TransactionType; _sum: { amount: Prisma.Decimal | null } }
type TransferInRow = { toAccountId: number | null; _sum: { amount: Prisma.Decimal | null } }

/**
 * Totaux par compte : revenus et dépenses portés par le compte,
 * solde net incluant les virements reçus et émis.
 */
function totalsByAccount(
  flows: FlowRow[],
  transfersIn: TransferInRow[],
  publicIds: Map<number, string>,
): TransactionTotalsByAccount {
  const acc = new Map<number, { income: number; expense: number; transferIn: number; transferOut: number }>()
  const slot = (id: number) => {
    const current = acc.get(id) ?? { income: 0, expense: 0, transferIn: 0, transferOut: 0 }
    acc.set(id, current)
    return current
  }

  for (const row of flows) {
    const amount = toNumber(row._sum.amount)
    const entry = slot(row.accountId)
    if (row.type === TransactionType.INCOME) entry.income += amount
    else if (row.type === TransactionType.EXPENSE) entry.expense += amount
    else entry.transferOut += amount
  }
  for (const row of transfersIn) {
    if (row.toAccountId === null) continue
    slot(row.toAccountId).transferIn += toNumber(row._sum.amount)
  }

  const result: TransactionTotalsByAccount = {}
  for (const [id, entry] of acc) {
    const publicId = publicIds.get(id)
    if (!publicId) continue
    result[publicId] = {
      income: round2(entry.income),
      expense: round2(entry.expense),
      net: round2(entry.income - entry.expense + entry.transferIn - entry.transferOut),
    }
  }
  return result
}

/** Liste paginée, filtrée et triée. Tout le tri est délégué à PostgreSQL. */
export async function getTransactions(
  page: number,
  limit: number,
  filters: TransactionFilters = {},
): Promise<
  Paginated<TransactionListItem> & { totals: TransactionTotals; totalsByAccount: TransactionTotalsByAccount }
> {
  const empty = {
    data: [] as TransactionListItem[],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    totals: { income: 0, expense: 0, net: 0 },
    totalsByAccount: {},
  }

  const ctx = await getUserContext()
  if (!ctx.ok) return empty

  const where = await buildWhere(ctx.user.id, filters)

  const sort = parseSortKey(filters.sort, TRANSACTION_SORTS, 'date')
  const dir = parseSortDir(filters.dir, 'desc')

  const orderBy: Prisma.TransactionOrderByWithRelationInput[] =
    sort === 'amount'
      ? [{ amount: dir }]
      : sort === 'description'
        ? [{ description: dir }]
        : sort === 'type'
          ? [{ type: dir }]
          : sort === 'category'
            ? [{ category: { name: dir } }]
            : sort === 'account'
              ? [{ account: { name: dir } }]
              : [{ date: dir }, { id: dir }]

  const [totalCount, aggregates, flows, transfersIn, userAccounts] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where,
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['toAccountId'],
      where: { AND: [where, { type: TransactionType.TRANSFER }] },
      _sum: { amount: true },
    }),
    prisma.account.findMany({
      where: { userId: ctx.user.id },
      select: { id: true, publicId: true },
    }),
  ])

  const meta = paginationMeta(totalCount, parsePage(page), parseLimit(limit))

  const rows = await prisma.transaction.findMany({
    where,
    orderBy,
    skip: meta.skip,
    take: meta.take,
    select: {
      publicId: true,
      type: true,
      amount: true,
      date: true,
      description: true,
      paymentMethod: true,
      isRecurring: true,
      category: { select: { publicId: true, name: true, icon: true, color: true } },
      account: { select: { publicId: true, name: true } },
      toAccount: { select: { publicId: true, name: true } },
    },
  })

  const income = toNumber(
    aggregates.find((row) => row.type === TransactionType.INCOME)?._sum.amount ?? null,
  )
  const expense = toNumber(
    aggregates.find((row) => row.type === TransactionType.EXPENSE)?._sum.amount ?? null,
  )

  return {
    data: rows.map((row) => ({
      publicId: row.publicId,
      type: row.type,
      amount: toNumber(row.amount),
      date: row.date.toISOString(),
      description: row.description,
      paymentMethod: row.paymentMethod,
      isRecurring: row.isRecurring,
      category: row.category,
      account: row.account,
      toAccount: row.toAccount,
    })),
    totalCount: meta.totalCount,
    totalPages: meta.totalPages,
    currentPage: meta.currentPage,
    totals: { income, expense, net: round2(income - expense) },
    totalsByAccount: totalsByAccount(
      flows,
      transfersIn,
      new Map(userAccounts.map((account) => [account.id, account.publicId])),
    ),
  }
}

async function buildWhere(
  userId: number,
  filters: TransactionFilters,
): Promise<Prisma.TransactionWhereInput> {
  const where: Prisma.TransactionWhereInput = { userId }

  const type = parseTypeFilter(filters.type)
  if (type !== 'all') where.type = type

  if (filters.categoryId) {
    const category = await prisma.category.findFirst({
      where: { publicId: filters.categoryId, userId },
      select: { id: true },
    })
    // Un identifiant inconnu ne doit pas élargir le résultat : on force le vide.
    where.categoryId = category?.id ?? -1
  }

  if (filters.accountId) {
    const account = await prisma.account.findFirst({
      where: { publicId: filters.accountId, userId },
      select: { id: true },
    })
    const accountId = account?.id ?? -1
    where.OR = [{ accountId }, { toAccountId: accountId }]
  }

  const from = filters.from ? fromDateInput(filters.from) : null
  const to = filters.to ? fromDateInput(filters.to) : null
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0) } : {}),
      // Borne haute inclusive : on va jusqu'au lendemain exclu.
      ...(to ? { lt: new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1, 0, 0, 0, 0) } : {}),
    }
  }

  const search = String(filters.q ?? '').trim()
  if (search) {
    where.description = { contains: search, mode: 'insensitive' }
  }

  return where
}

export type TransactionAccountOption = {
  publicId: string
  name: string
  type: AccountType
}

export type TransactionRecurringHint = {
  publicId: string
  label: string
  categoryPublicId: string | null
}

export type TransactionFormOptions = {
  categories: Array<{
    publicId: string
    name: string
    type: CategoryType
    icon: string
    color: string
  }>
  accounts: TransactionAccountOption[]
  recurringTransactions: TransactionRecurringHint[]
}

/** Référentiels nécessaires aux filtres et à la modale de saisie. */
export async function getTransactionFormOptions(): Promise<TransactionFormOptions> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { categories: [], accounts: [], recurringTransactions: [] }

  const [categories, accounts, recurring] = await Promise.all([
    prisma.category.findMany({
      where: { userId: ctx.user.id, isArchived: false },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { publicId: true, name: true, type: true, icon: true, color: true },
    }),
    prisma.account.findMany({
      where: { userId: ctx.user.id, isArchived: false },
      orderBy: { name: 'asc' },
      select: { publicId: true, name: true, type: true },
    }),
    prisma.recurringTransaction.findMany({
      where: { userId: ctx.user.id, active: true },
      orderBy: { label: 'asc' },
      select: {
        publicId: true,
        label: true,
        category: { select: { publicId: true } },
      },
    }),
  ])

  return {
    categories,
    accounts,
    recurringTransactions: recurring.map((item) => ({
      publicId: item.publicId,
      label: item.label,
      categoryPublicId: item.category?.publicId ?? null,
    })),
  }
}
