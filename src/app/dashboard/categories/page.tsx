import type { Metadata } from 'next'
import { CategoryType } from '@prisma/client'
import { CategoryModal } from '@/components/categories/category-modal'
import { CategoryWorkspace } from '@/components/categories/category-workspace'
import { requireUser } from '@/lib/user-context'
import { pick, type SearchParams } from '@/lib/params'
import { parseLimit, parsePage } from '@/lib/pagination'
import { getCategories } from './actions'

export const metadata: Metadata = {
  title: 'PF | Catégories',
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireUser()
  const params = await searchParams
  const limit = parseLimit(pick(params, 'limit'))
  const archived = pick(params, 'archived') === '1'
  const expensePage = parsePage(pick(params, 'page'))
  const incomePage = parsePage(pick(params, 'incomePage'))

  const [expenses, incomes] = await Promise.all([
    getCategories(expensePage, limit, CategoryType.EXPENSE, archived),
    getCategories(incomePage, limit, CategoryType.INCOME, archived),
  ])

  const editing =
    [...expenses.data, ...incomes.data].find((category) => category.publicId === pick(params, 'edit')) ?? null

  return (
    <>
      <CategoryWorkspace
        limit={limit}
        archived={archived}
        currency={user.currency}
        expenses={{
          title: 'Dépenses',
          noun: 'dépense',
          nounPlural: 'dépenses',
          pageParam: 'page',
          items: expenses.data,
          totalCount: expenses.totalCount,
          currentPage: expenses.currentPage,
        }}
        incomes={{
          title: 'Revenus',
          noun: 'revenu',
          nounPlural: 'revenus',
          pageParam: 'incomePage',
          items: incomes.data,
          totalCount: incomes.totalCount,
          currentPage: incomes.currentPage,
        }}
      />
      <CategoryModal
        open={pick(params, 'modal') === 'category' || editing !== null}
        category={editing}
        currency={user.currency}
      />
    </>
  )
}
