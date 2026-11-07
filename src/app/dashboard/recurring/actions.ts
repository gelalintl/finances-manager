'use server'

import { revalidatePath } from 'next/cache'
import { AccountType, CategoryType, PaymentMethod, Prisma, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserContext } from '@/lib/user-context'
import { parseAmount, toNumber } from '@/lib/money'
import { paginationMeta, parseLimit, parsePage, type Paginated } from '@/lib/pagination'
import { parseSortDir, parseSortKey } from '@/lib/table-sort'
import { monthRange, yearRange } from '@/lib/dates'
import {
  isRecurringDue,
  occurrenceDate,
  parseDayOfMonth,
  parseFrequency,
  parseRecurringType,
  RECURRING_SORTS,
  recurringPeriod,
  type RecurringListItem,
} from '@/lib/recurring'

const RECURRING_PATH = '/dashboard/recurring'
const MAX_MONEY = 999_999_999_999.99

type MutationResult = { ok: true } | { ok: false; error: string }

export type RecurringFormOptions = {
  categories: Array<{
    publicId: string
    name: string
    type: CategoryType
    icon: string
    color: string
  }>
  accounts: Array<{ publicId: string; name: string }>
}

function revalidateRecurring() {
  revalidatePath(RECURRING_PATH)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard/categories')
}

/**
 * Retrouve ou crée la catégorie qui porte le libellé de l'échéance,
 * pour que la saisie d'une transaction puisse reconnaître la charge fixe.
 */
async function ensureNamedCategory(userId: number, label: string, type: TransactionType) {
  const categoryType = type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE
  const existing = await prisma.category.findFirst({
    where: { userId, type: categoryType, name: { equals: label, mode: 'insensitive' } },
    select: { id: true, isArchived: true },
  })
  if (existing) {
    if (existing.isArchived) {
      await prisma.category.update({ where: { id: existing.id }, data: { isArchived: false } })
    }
    return existing.id
  }

  try {
    const created = await prisma.category.create({
      data: {
        userId,
        name: label,
        type: categoryType,
        icon: categoryType === CategoryType.INCOME ? 'Briefcase' : 'Repeat',
        color: categoryType === CategoryType.INCOME ? '#059669' : '#4f46e5',
      },
      select: { id: true },
    })
    return created.id
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.category.findFirst({
        where: { userId, type: categoryType, name: { equals: label, mode: 'insensitive' } },
        select: { id: true },
      })
      if (raced) return raced.id
    }
    throw error
  }
}

function readLabel(value: unknown) {
  const label = String(value ?? '').trim()
  if (!label || label.length > 120) return null
  return label
}

function mutationError(error: unknown, fallback: string): MutationResult {
  console.error(fallback, error)
  return { ok: false, error: fallback }
}

function paymentFor(type: TransactionType, accountType: AccountType): PaymentMethod {
  if (accountType === AccountType.CASH) return PaymentMethod.CASH
  if (accountType === AccountType.MOBILE_MONEY) return PaymentMethod.MOBILE_MONEY
  if (accountType === AccountType.CARD) return PaymentMethod.CARD
  return type === TransactionType.INCOME ? PaymentMethod.BANK_TRANSFER : PaymentMethod.DIRECT_DEBIT
}

type PostStatus = 'created' | 'exists' | 'skipped' | 'missing' | 'unsupported' | 'error'

/**
 * Poste l'écriture de la période en cours.
 * `onlyIfDue` réserve la génération automatique aux échéances dont le jour est atteint.
 * Le verrou transactionnel empêche un double posting si deux appels se croisent.
 */
async function postRecurring(
  userId: number,
  recurringId: number,
  onlyIfDue: boolean,
): Promise<{ status: PostStatus; date?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${recurringId}::integer, 0)`

    const recurring = await tx.recurringTransaction.findFirst({
      where: { id: recurringId, userId },
      select: {
        id: true,
        label: true,
        type: true,
        amount: true,
        categoryId: true,
        accountId: true,
        frequency: true,
        dayOfMonth: true,
        active: true,
        account: { select: { type: true } },
      },
    })
    if (!recurring) return { status: 'missing' }
    if (onlyIfDue && !recurring.active) return { status: 'skipped' }
    if (recurring.type === TransactionType.TRANSFER) return { status: 'unsupported' }

    const now = new Date()
    if (onlyIfDue && !isRecurringDue(recurring.dayOfMonth, now)) return { status: 'skipped' }

    const period = recurringPeriod(recurring.frequency, now)
    const existing = await tx.transaction.findFirst({
      where: {
        userId,
        recurringTransactionId: recurring.id,
        date: { gte: period.start, lt: period.end },
      },
      select: { id: true },
    })
    if (existing) {
      await tx.recurringTransaction.update({
        where: { id: recurring.id },
        data: { lastRunAt: now },
      })
      return { status: 'exists' }
    }

    const date = occurrenceDate(recurring.dayOfMonth, now)
    await tx.transaction.create({
      data: {
        userId,
        type: recurring.type,
        amount: recurring.amount,
        date,
        description: recurring.label,
        categoryId: recurring.categoryId,
        accountId: recurring.accountId,
        paymentMethod: paymentFor(recurring.type, recurring.account.type),
        isRecurring: true,
        recurringTransactionId: recurring.id,
      },
    })
    await tx.recurringTransaction.update({
      where: { id: recurring.id },
      data: { lastRunAt: now },
    })

    return { status: 'created' as const, date: date.toISOString() }
    })
  } catch (error) {
    console.error('Erreur génération échéance:', error)
    return { status: 'error' as const }
  }
}

function readRecurringForm(formData: FormData) {
  const label = readLabel(formData.get('label'))
  const type = parseRecurringType(formData.get('type'))
  const amount = parseAmount(formData.get('amount'))
  const frequency = parseFrequency(formData.get('frequency'))
  const dayOfMonth = parseDayOfMonth(formData.get('dayOfMonth'))
  const accountPublicId = String(formData.get('accountId') ?? '')
  const categoryPublicId = String(formData.get('categoryId') ?? '')
  const active = String(formData.get('active') ?? '') === 'true'

  if (!label) return { ok: false as const, error: 'Indiquez un libellé (120 caractères maximum).' }
  if (!type) return { ok: false as const, error: 'Choisissez un revenu ou une dépense.' }
  if (amount === null || amount <= 0 || amount > MAX_MONEY) {
    return { ok: false as const, error: 'Le montant doit être supérieur à 0.' }
  }
  if (!frequency) return { ok: false as const, error: 'Choisissez une fréquence.' }
  if (dayOfMonth === null) return { ok: false as const, error: 'Le jour du mois doit être compris entre 1 et 31.' }
  if (!accountPublicId) return { ok: false as const, error: 'Choisissez un compte.' }

  return {
    ok: true as const,
    label,
    type,
    amount,
    frequency,
    dayOfMonth,
    accountPublicId,
    categoryPublicId,
    active,
  }
}

export async function getRecurring(
  page: number,
  limit: number,
  sortKey?: string,
  sortDir?: string,
): Promise<Paginated<RecurringListItem>> {
  const empty: Paginated<RecurringListItem> = {
    data: [],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
  }

  const ctx = await getUserContext()
  if (!ctx.ok) return empty

  const where = { userId: ctx.user.id }
  const totalCount = await prisma.recurringTransaction.count({ where })
  const meta = paginationMeta(totalCount, parsePage(page), parseLimit(limit))
  const sort = parseSortKey(sortKey, RECURRING_SORTS, 'label')
  const dir = parseSortDir(sortDir, 'asc')

  const orderBy: Prisma.RecurringTransactionOrderByWithRelationInput =
    sort === 'amount'
      ? { amount: dir }
      : sort === 'frequency'
        ? { frequency: dir }
        : sort === 'dayOfMonth'
          ? { dayOfMonth: dir }
          : sort === 'category'
            ? { category: { name: dir } }
            : { label: dir }

  const rows = await prisma.recurringTransaction.findMany({
    where,
    orderBy,
    skip: meta.skip,
    take: meta.take,
    select: {
      id: true,
      publicId: true,
      label: true,
      type: true,
      amount: true,
      frequency: true,
      dayOfMonth: true,
      active: true,
      lastRunAt: true,
      category: { select: { publicId: true, name: true, icon: true, color: true, type: true } },
      account: { select: { publicId: true, name: true } },
    },
  })

  const now = new Date()
  const year = yearRange(now)
  const month = monthRange(now)
  const ids = rows.map((row) => row.id)
  const posts =
    ids.length === 0
      ? []
      : await prisma.transaction.findMany({
          where: {
            userId: ctx.user.id,
            recurringTransactionId: { in: ids },
            date: { gte: year.start, lt: year.end },
          },
          select: { recurringTransactionId: true, date: true },
        })

  return {
    data: rows.map((row) => {
      const period = row.frequency === 'YEARLY' ? year : month
      const postedThisPeriod = posts.some(
        (post) =>
          post.recurringTransactionId === row.id &&
          post.date >= period.start &&
          post.date < period.end,
      )
      return {
        publicId: row.publicId,
        label: row.label,
        type: row.type,
        amount: toNumber(row.amount),
        frequency: row.frequency,
        dayOfMonth: row.dayOfMonth,
        active: row.active,
        lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
        postedThisPeriod,
        category: row.category,
        account: row.account,
      }
    }),
    totalCount: meta.totalCount,
    totalPages: meta.totalPages,
    currentPage: meta.currentPage,
  }
}

export async function getRecurringFormOptions(): Promise<RecurringFormOptions> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { categories: [], accounts: [] }

  const [categories, accounts] = await Promise.all([
    prisma.category.findMany({
      where: { userId: ctx.user.id, isArchived: false },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { publicId: true, name: true, type: true, icon: true, color: true },
    }),
    prisma.account.findMany({
      where: { userId: ctx.user.id, isArchived: false },
      orderBy: { name: 'asc' },
      select: { publicId: true, name: true },
    }),
  ])

  return { categories, accounts }
}

export async function createRecurring(formData: FormData): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const parsed = readRecurringForm(formData)
  if (!parsed.ok) return parsed

  const account = await prisma.account.findFirst({
    where: { publicId: parsed.accountPublicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!account) return { ok: false, error: 'Compte introuvable.' }

  try {
    const categoryId = await ensureNamedCategory(ctx.user.id, parsed.label, parsed.type)
    await prisma.recurringTransaction.create({
      data: {
        userId: ctx.user.id,
        label: parsed.label,
        type: parsed.type,
        amount: parsed.amount,
        frequency: parsed.frequency,
        dayOfMonth: parsed.dayOfMonth,
        active: parsed.active,
        accountId: account.id,
        categoryId,
      },
    })
  } catch (error) {
    return mutationError(error, "La création de l'échéance a échoué.")
  }

  revalidateRecurring()
  return { ok: true }
}

export async function updateRecurring(formData: FormData): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const publicId = String(formData.get('publicId') ?? '')
  const parsed = readRecurringForm(formData)
  if (!publicId) return { ok: false, error: 'Échéance introuvable.' }
  if (!parsed.ok) return parsed

  const current = await prisma.recurringTransaction.findFirst({
    where: { publicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!current) return { ok: false, error: 'Échéance introuvable.' }

  const account = await prisma.account.findFirst({
    where: { publicId: parsed.accountPublicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!account) return { ok: false, error: 'Compte introuvable.' }

  try {
    const categoryId = await ensureNamedCategory(ctx.user.id, parsed.label, parsed.type)
    await prisma.recurringTransaction.update({
      where: { id: current.id },
      data: {
        label: parsed.label,
        type: parsed.type,
        amount: parsed.amount,
        frequency: parsed.frequency,
        dayOfMonth: parsed.dayOfMonth,
        active: parsed.active,
        accountId: account.id,
        categoryId,
      },
    })
  } catch (error) {
    return mutationError(error, "La mise à jour de l'échéance a échoué.")
  }

  revalidateRecurring()
  return { ok: true }
}

export async function setRecurringActive(publicId: string, active: boolean): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const recurring = await prisma.recurringTransaction.findFirst({
    where: { publicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!recurring) return { ok: false, error: 'Échéance introuvable.' }

  await prisma.recurringTransaction.update({
    where: { id: recurring.id },
    data: { active },
  })

  revalidateRecurring()
  return { ok: true }
}

export async function deleteRecurring(publicId: string): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const recurring = await prisma.recurringTransaction.findFirst({
    where: { publicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!recurring) return { ok: false, error: 'Échéance introuvable.' }

  await prisma.recurringTransaction.delete({ where: { id: recurring.id } })

  revalidateRecurring()
  return { ok: true }
}

export async function generateRecurringTransaction(
  publicId: string,
): Promise<MutationResult & { date?: string }> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const recurring = await prisma.recurringTransaction.findFirst({
    where: { publicId, userId: ctx.user.id },
    select: { id: true, frequency: true },
  })
  if (!recurring) return { ok: false, error: 'Échéance introuvable.' }

  const posted = await postRecurring(ctx.user.id, recurring.id, false)
  if (posted.status === 'missing') return { ok: false, error: 'Échéance introuvable.' }
  if (posted.status === 'unsupported') {
    return { ok: false, error: 'Seuls les revenus et les dépenses peuvent être générés.' }
  }
  if (posted.status === 'exists') {
    const period = recurring.frequency === 'YEARLY' ? 'cette année' : 'ce mois'
    return { ok: false, error: `La transaction de ${period} existe déjà.` }
  }
  if (posted.status !== 'created') return { ok: false, error: "La génération de l'échéance a échoué." }

  revalidateRecurring()
  return { ok: true, date: posted.date }
}

/** Poste toutes les échéances actives dont le jour du mois est atteint et encore absentes. */
export async function generateDueRecurring(): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const rows = await prisma.recurringTransaction.findMany({
    where: { userId: ctx.user.id, active: true },
    select: { id: true, dayOfMonth: true, type: true },
  })

  const now = new Date()
  let created = 0
  let failed = false
  for (const row of rows) {
    if (row.type === TransactionType.TRANSFER) continue
    if (!isRecurringDue(row.dayOfMonth, now)) continue
    const posted = await postRecurring(ctx.user.id, row.id, true)
    if (posted.status === 'created') created += 1
    if (posted.status === 'error') failed = true
  }

  if (failed && created === 0) return { ok: false, error: 'La génération automatique a échoué.' }
  if (created > 0) revalidateRecurring()
  return { ok: true, created }
}

/** Force la génération de toutes les échéances actives encore absentes de la période. */
export async function generateCurrentMonthRecurring(): Promise<
  { ok: true; created: number } | { ok: false; error: string }
> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const rows = await prisma.recurringTransaction.findMany({
    where: { userId: ctx.user.id, active: true },
    select: { id: true, type: true },
  })

  let created = 0
  let failed = false
  for (const row of rows) {
    if (row.type === TransactionType.TRANSFER) continue
    const posted = await postRecurring(ctx.user.id, row.id, false)
    if (posted.status === 'created') created += 1
    if (posted.status === 'error') failed = true
  }

  if (failed && created === 0) return { ok: false, error: 'La génération du mois a échoué.' }
  if (created > 0) revalidateRecurring()
  return { ok: true, created }
}
