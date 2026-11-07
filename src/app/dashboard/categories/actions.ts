'use server'

import { revalidatePath } from 'next/cache'
import { CategoryType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserContext } from '@/lib/user-context'
import {
  parseBudgetLimit,
  parseCategoryColor,
  parseCategoryIcon,
  parseCategoryType,
  type CategoryListItem,
} from '@/lib/categories'
import { toNumber } from '@/lib/money'
import { paginationMeta, parseLimit, parsePage, type Paginated } from '@/lib/pagination'

const CATEGORIES_PATH = '/dashboard/categories'

type MutationResult = { ok: true } | { ok: false; error: string }

function revalidateCategories() {
  revalidatePath(CATEGORIES_PATH)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard/recurring')
}

function readName(value: unknown) {
  const name = String(value ?? '').trim()
  if (!name || name.length > 80) return null
  return name
}

function mutationError(error: unknown, fallback: string): MutationResult {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return { ok: false, error: 'Une catégorie portant ce nom existe déjà pour ce type.' }
  }
  console.error(fallback, error)
  return { ok: false, error: fallback }
}

function readCategoryForm(formData: FormData) {
  const name = readName(formData.get('name'))
  const type = parseCategoryType(formData.get('type'))
  const icon = parseCategoryIcon(formData.get('icon'))
  const color = parseCategoryColor(formData.get('color'))
  const budgetLimit = parseBudgetLimit(formData.get('budgetLimit'))

  if (!name) return { ok: false as const, error: 'Indiquez un nom de catégorie (80 caractères maximum).' }
  if (!type) return { ok: false as const, error: 'Choisissez un type : revenu ou dépense.' }
  if (!icon) return { ok: false as const, error: 'Choisissez une icône du registre.' }
  if (!color) return { ok: false as const, error: 'Choisissez une couleur valide.' }
  if (budgetLimit === undefined) {
    return { ok: false as const, error: 'Le plafond mensuel doit être un montant positif, ou vide.' }
  }

  return { ok: true as const, name, type, icon, color, budgetLimit }
}

export async function getCategories(
  page: number,
  limit: number,
  type: CategoryType,
  archived = false,
): Promise<Paginated<CategoryListItem>> {
  const empty: Paginated<CategoryListItem> = {
    data: [],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
  }

  const ctx = await getUserContext()
  if (!ctx.ok) return empty

  const where = { userId: ctx.user.id, type, isArchived: archived }
  const totalCount = await prisma.category.count({ where })
  const meta = paginationMeta(totalCount, parsePage(page), parseLimit(limit))

  const rows = await prisma.category.findMany({
    where,
    orderBy: { name: 'asc' },
    skip: meta.skip,
    take: meta.take,
    select: {
      publicId: true,
      name: true,
      type: true,
      icon: true,
      color: true,
      budgetLimit: true,
      isArchived: true,
    },
  })

  return {
    data: rows.map((row) => ({
      publicId: row.publicId,
      name: row.name,
      type: row.type,
      icon: row.icon,
      color: row.color,
      budgetLimit: row.budgetLimit === null ? null : toNumber(row.budgetLimit),
      isArchived: row.isArchived,
    })),
    totalCount: meta.totalCount,
    totalPages: meta.totalPages,
    currentPage: meta.currentPage,
  }
}

export async function createCategory(formData: FormData): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const parsed = readCategoryForm(formData)
  if (!parsed.ok) return parsed

  try {
    await prisma.category.create({
      data: {
        userId: ctx.user.id,
        name: parsed.name,
        type: parsed.type,
        icon: parsed.icon,
        color: parsed.color,
        budgetLimit: parsed.budgetLimit,
      },
    })
  } catch (error) {
    return mutationError(error, 'La création de la catégorie a échoué.')
  }

  revalidateCategories()
  return { ok: true }
}

export async function updateCategory(formData: FormData): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const publicId = String(formData.get('publicId') ?? '')
  const parsed = readCategoryForm(formData)
  if (!publicId) return { ok: false, error: 'Catégorie introuvable.' }
  if (!parsed.ok) return parsed

  const category = await prisma.category.findFirst({
    where: { publicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!category) return { ok: false, error: 'Catégorie introuvable.' }

  try {
    await prisma.category.update({
      where: { id: category.id },
      data: {
        name: parsed.name,
        type: parsed.type,
        icon: parsed.icon,
        color: parsed.color,
        budgetLimit: parsed.budgetLimit,
      },
    })
  } catch (error) {
    return mutationError(error, 'La mise à jour de la catégorie a échoué.')
  }

  revalidateCategories()
  return { ok: true }
}

export async function setCategoryArchived(publicId: string, archived: boolean): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const category = await prisma.category.findFirst({
    where: { publicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!category) return { ok: false, error: 'Catégorie introuvable.' }

  await prisma.category.update({
    where: { id: category.id },
    data: { isArchived: archived },
  })

  revalidateCategories()
  return { ok: true }
}

export async function deleteCategory(publicId: string): Promise<MutationResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const category = await prisma.category.findFirst({
    where: { publicId, userId: ctx.user.id },
    select: { id: true },
  })
  if (!category) return { ok: false, error: 'Catégorie introuvable.' }

  await prisma.category.delete({ where: { id: category.id } })

  revalidateCategories()
  return { ok: true }
}
