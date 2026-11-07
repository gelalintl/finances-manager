'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, type DataColumn } from '@/components/ui/data-table'
import { IconButton } from '@/components/ui/icon-button'
import { CategoryBadge } from '@/components/ui/category-icon'
import { Caption, Heading } from '@/components/ui/typography'
import { deleteCategory, setCategoryArchived } from '@/app/dashboard/categories/actions'
import type { CategoryListItem } from '@/lib/categories'
import { formatMoney } from '@/lib/money'
import { toastResult } from '@/lib/notify'
import { useSearchPatch } from '@/lib/search-params'

type CategorySection = {
  title: string
  noun: string
  nounPlural: string
  pageParam: string
  items: CategoryListItem[]
  totalCount: number
  currentPage: number
}

type CategoryWorkspaceProps = {
  expenses: CategorySection
  incomes: CategorySection
  limit: number
  archived: boolean
  currency: string
}

export function CategoryWorkspace({
  expenses,
  incomes,
  limit,
  archived,
  currency,
}: CategoryWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const patch = useSearchPatch()
  const [pendingId, setPendingId] = useState<string | null>(null)

  function toggleArchived() {
    const params = new URLSearchParams(searchParams.toString())
    if (archived) params.delete('archived')
    else params.set('archived', '1')
    params.delete('page')
    params.delete('incomePage')
    params.delete('modal')
    params.delete('edit')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  async function handleArchive(category: CategoryListItem) {
    const next = !category.isArchived
    const message = next
      ? `Archiver la catégorie « ${category.name} » ?`
      : `Réactiver la catégorie « ${category.name} » ?`
    if (!window.confirm(message)) return

    setPendingId(category.publicId)
    const result = await setCategoryArchived(category.publicId, next)
    setPendingId(null)
    toastResult(result, next ? 'Catégorie archivée.' : 'Catégorie réactivée.')
  }

  async function handleDelete(category: CategoryListItem) {
    if (
      !window.confirm(
        `Supprimer la catégorie « ${category.name} » ? Les transactions associées resteront sans catégorie.`,
      )
    ) {
      return
    }
    setPendingId(category.publicId)
    const result = await deleteCategory(category.publicId)
    setPendingId(null)
    toastResult(result, 'Catégorie supprimée.')
  }

  const columns: Array<DataColumn<CategoryListItem>> = [
    {
      id: 'name',
      header: 'Catégorie',
      cell: (category) => <CategoryBadge name={category.name} icon={category.icon} color={category.color} />,
    },
    {
      id: 'color',
      header: 'Couleur',
      headerClassName: 'w-36',
      cell: (category) => (
        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: category.color }} aria-hidden />
          {category.color}
        </span>
      ),
    },
    {
      id: 'budget',
      header: 'Plafond',
      headerClassName: 'w-44',
      cell: (category) =>
        category.budgetLimit === null ? (
          <Caption>Non plafonné</Caption>
        ) : (
          <span className="text-sm font-bold text-foreground">{formatMoney(category.budgetLimit, currency)}</span>
        ),
    },
  ]

  function sectionTable(section: CategorySection, persistSize: boolean) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <Heading as="h2" size="lg">
            {section.title}
          </Heading>
          <Caption className="mt-1 block">
            {section.totalCount} {section.totalCount === 1 ? section.noun : section.nounPlural}
          </Caption>
        </div>
        <DataTable
          rows={section.items}
          columns={columns}
          rowKey={(category) => category.publicId}
          totalCount={section.totalCount}
          currentPage={section.currentPage}
          limit={limit}
          persistSize={persistSize}
          pageParam={section.pageParam}
          itemNoun={section.noun}
          itemNounPlural={section.nounPlural}
          minWidth="min-w-[40rem]"
          emptyTitle="Aucune catégorie"
          emptyHint={archived ? 'Rien dans les archives pour ce type.' : 'Ajoutez une catégorie pour ce type.'}
          actions={(category) => {
            const busy = pendingId === category.publicId
            return (
              <>
                <IconButton label="Modifier" disabled={busy} onClick={() => patch({ edit: category.publicId, modal: null })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label={category.isArchived ? 'Réactiver' : 'Archiver'}
                  disabled={busy}
                  onClick={() => void handleArchive(category)}
                >
                  {category.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                </IconButton>
                <IconButton label="Supprimer" tone="danger" disabled={busy} onClick={() => void handleDelete(category)}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </>
            )
          }}
        />
      </section>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Heading as="h1" size="xl">
            Catégories
          </Heading>
          <Caption className="mt-1 block">
            {expenses.totalCount} dépense{expenses.totalCount > 1 ? 's' : ''} · {incomes.totalCount} revenu
            {incomes.totalCount > 1 ? 's' : ''}
          </Caption>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={toggleArchived}>
            {archived ? 'Voir les actives' : 'Voir les archivées'}
          </Button>
          <Button onClick={() => patch({ modal: 'category', edit: null })}>
            <Plus className="h-4 w-4" />
            Nouvelle catégorie
          </Button>
        </div>
      </header>

      {sectionTable(expenses, true)}
      {sectionTable(incomes, false)}
    </div>
  )
}
