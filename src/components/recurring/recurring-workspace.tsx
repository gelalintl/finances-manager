'use client'

import { useEffect, useState } from 'react'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { TransactionType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { DataTable, type DataColumn } from '@/components/ui/data-table'
import { IconButton } from '@/components/ui/icon-button'
import { CategoryBadge } from '@/components/ui/category-icon'
import { Caption, Heading } from '@/components/ui/typography'
import {
  deleteRecurring,
  generateCurrentMonthRecurring,
  generateDueRecurring,
  generateRecurringTransaction,
  setRecurringActive,
} from '@/app/dashboard/recurring/actions'
import { formatDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { toastResult } from '@/lib/notify'
import { frequencyLabels, periodStatusLabel, type RecurringListItem } from '@/lib/recurring'
import { useSearchPatch } from '@/lib/search-params'
import { typeToneClasses } from '@/lib/transactions'
import { cn } from '@/lib/cn'

type RecurringWorkspaceProps = {
  items: RecurringListItem[]
  totalCount: number
  currentPage: number
  limit: number
  currency: string
}

export function RecurringWorkspace({
  items,
  totalCount,
  currentPage,
  limit,
  currency,
}: RecurringWorkspaceProps) {
  const patch = useSearchPatch()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [generatingMonth, setGeneratingMonth] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await generateDueRecurring()
      if (cancelled) return
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (result.created === 0) return
      toast.success(
        result.created > 1
          ? `${result.created} échéances générées pour le mois en cours.`
          : '1 échéance générée pour le mois en cours.',
      )
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleToggle(item: RecurringListItem) {
    setPendingId(item.publicId)
    const result = await setRecurringActive(item.publicId, !item.active)
    setPendingId(null)
    toastResult(result, item.active ? 'Échéance désactivée.' : 'Échéance activée.')
  }

  async function handleGenerate(item: RecurringListItem) {
    setPendingId(item.publicId)
    const result = await generateRecurringTransaction(item.publicId)
    setPendingId(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(
      result.date ? `Transaction du ${formatDate(result.date)} enregistrée.` : 'Transaction enregistrée.',
    )
  }

  async function handleGenerateMonth() {
    setGeneratingMonth(true)
    const result = await generateCurrentMonthRecurring()
    setGeneratingMonth(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    if (result.created === 0) {
      toast.success('Toutes les échéances actives sont déjà générées.')
      return
    }
    toast.success(
      result.created > 1
        ? `${result.created} transactions créées pour la période en cours.`
        : '1 transaction créée pour la période en cours.',
    )
  }

  async function handleDelete(item: RecurringListItem) {
    if (!window.confirm(`Supprimer l'échéance « ${item.label} » ? Les transactions déjà créées sont conservées.`)) {
      return
    }
    setPendingId(item.publicId)
    const result = await deleteRecurring(item.publicId)
    setPendingId(null)
    toastResult(result, 'Échéance supprimée.')
  }

  const columns: Array<DataColumn<RecurringListItem>> = [
    {
      id: 'label',
      header: 'Libellé',
      sortable: true,
      fallbackDir: 'asc',
      cell: (item) => (
        <div>
          <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
          <Caption className="mt-0.5 block truncate">{item.account.name}</Caption>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Montant',
      sortable: true,
      fallbackKey: 'label',
      fallbackDir: 'asc',
      initialDir: 'desc',
      align: 'right',
      headerClassName: 'w-36',
      cell: (item) => (
        <span className={cn('text-sm font-bold whitespace-nowrap', typeToneClasses[item.type])}>
          {item.type === TransactionType.INCOME ? '+' : '\u2212'}
          {formatMoney(item.amount, currency)}
        </span>
      ),
    },
    {
      id: 'category',
      header: 'Catégorie',
      sortable: true,
      fallbackKey: 'label',
      fallbackDir: 'asc',
      headerClassName: 'w-44',
      cell: (item) =>
        item.category ? (
          <CategoryBadge name={item.category.name} icon={item.category.icon} color={item.category.color} />
        ) : (
          <Caption>—</Caption>
        ),
    },
    {
      id: 'frequency',
      header: 'Fréquence',
      sortable: true,
      fallbackKey: 'label',
      fallbackDir: 'asc',
      headerClassName: 'w-32',
      cell: (item) => <span className="text-sm font-medium text-foreground">{frequencyLabels[item.frequency]}</span>,
    },
    {
      id: 'dayOfMonth',
      header: 'Jour',
      sortable: true,
      fallbackKey: 'label',
      fallbackDir: 'asc',
      headerClassName: 'w-24',
      cell: (item) => <span className="text-sm font-bold text-foreground">{item.dayOfMonth}</span>,
    },
    {
      id: 'active',
      header: 'Actif',
      headerClassName: 'w-28',
      cell: (item) => {
        const busy = pendingId === item.publicId
        return (
          <button
            type="button"
            role="switch"
            aria-checked={item.active}
            aria-label={item.active ? `Désactiver ${item.label}` : `Activer ${item.label}`}
            disabled={busy}
            onClick={() => void handleToggle(item)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40',
              item.active ? 'bg-primary' : 'bg-foreground/20',
            )}
          >
            <span
              className={cn(
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
                item.active ? 'translate-x-5' : 'translate-x-0.5',
              )}
            />
          </button>
        )
      },
    },
    {
      id: 'period',
      header: 'Période',
      headerClassName: 'w-44',
      cell: (item) => (
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
            item.postedThisPeriod ? 'bg-income/10 text-income' : 'bg-warning/10 text-warning',
          )}
        >
          {periodStatusLabel(item.frequency, item.postedThisPeriod)}
        </span>
      ),
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Heading as="h1" size="xl">
            Charges fixes et récurrences
          </Heading>
          <Caption className="mt-1 block">
            {totalCount} échéance{totalCount > 1 ? 's' : ''}. Les actives dont le jour est atteint sont générées à
            l&apos;ouverture.
          </Caption>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleGenerateMonth()} isLoading={generatingMonth}>
            Générer le mois
          </Button>
          <Button onClick={() => patch({ modal: 'recurring', edit: null })}>
            <Plus className="h-4 w-4" />
            Nouvelle échéance
          </Button>
        </div>
      </header>

      <DataTable
        rows={items}
        columns={columns}
        rowKey={(item) => item.publicId}
        totalCount={totalCount}
        currentPage={currentPage}
        limit={limit}
        itemNoun="récurrence"
        itemNounPlural="récurrences"
        minWidth="min-w-[68rem]"
        emptyTitle="Aucune échéance"
        emptyHint="Ajoutez un loyer, un abonnement ou un revenu automatique."
        actions={(item) => {
          const busy = pendingId === item.publicId
          return (
            <>
              <IconButton
                label="Générer"
                disabled={busy || item.postedThisPeriod}
                onClick={() => void handleGenerate(item)}
              >
                <RefreshCw className="h-4 w-4" />
              </IconButton>
              <IconButton label="Modifier" disabled={busy} onClick={() => patch({ edit: item.publicId, modal: null })}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton label="Supprimer" tone="danger" disabled={busy} onClick={() => void handleDelete(item)}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </>
          )
        }}
      />
    </div>
  )
}
