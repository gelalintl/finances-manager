'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { TransactionType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type DataColumn } from '@/components/ui/data-table'
import { IconButton } from '@/components/ui/icon-button'
import { CategoryBadge } from '@/components/ui/category-icon'
import { Caption, Heading, Text } from '@/components/ui/typography'
import {
  TransactionFilters as FiltersPanel,
  type FilterState,
} from '@/components/transactions/transaction-filters'
import { deleteTransaction } from '@/app/dashboard/transactions/actions'
import type { TransactionFormOptions, TransactionTotals } from '@/app/dashboard/transactions/actions'
import { formatDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { toastResult } from '@/lib/notify'
import { useSearchPatch } from '@/lib/search-params'
import {
  paymentMethodLabels,
  transactionTypeLabels,
  typeToneClasses,
  type TransactionListItem,
} from '@/lib/transactions'
import { cn } from '@/lib/cn'

type TransactionWorkspaceProps = {
  transactions: TransactionListItem[]
  totalCount: number
  currentPage: number
  limit: number
  totals: TransactionTotals
  filters: FilterState
  options: TransactionFormOptions
  currency: string
}

const SEARCH_DEBOUNCE_MS = 350

export function TransactionWorkspace({
  transactions,
  totalCount,
  currentPage,
  limit,
  totals,
  filters,
  options,
  currency,
}: TransactionWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const patch = useSearchPatch()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [query, setQuery] = useState(filters.q)
  const debounceRef = useRef<number | null>(null)

  const draft: FilterState = { ...filters, q: query }

  const pushParams = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      params.delete('page')
      const queryString = params.toString()
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  function handleChange(change: Partial<FilterState>) {
    const next = { ...draft, ...change }
    const { q, ...rest } = change

    const urlPatch: Record<string, string> = {}
    if ('type' in rest) urlPatch.type = next.type === 'all' ? '' : next.type
    if ('categoryId' in rest || 'type' in rest) urlPatch.categoryId = next.categoryId
    if ('accountId' in rest) urlPatch.accountId = next.accountId
    if ('from' in rest) urlPatch.from = next.from
    if ('to' in rest) urlPatch.to = next.to
    if (Object.keys(urlPatch).length > 0) pushParams(urlPatch)

    if (q !== undefined) {
      setQuery(q)
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => pushParams({ q }), SEARCH_DEBOUNCE_MS)
    }
  }

  function handleReset() {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    setQuery('')
    pushParams({ type: '', categoryId: '', accountId: '', from: '', to: '', q: '' })
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [])

  async function handleDelete(publicId: string) {
    setPendingId(publicId)
    const result = await deleteTransaction(publicId)
    setPendingId(null)
    toastResult(result, 'Transaction supprimée.')
  }

  const hasActiveFilters =
    draft.type !== 'all' || Boolean(draft.categoryId || draft.accountId || draft.from || draft.to || draft.q)

  const columns: Array<DataColumn<TransactionListItem>> = [
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      fallbackKey: 'date',
      fallbackDir: 'desc',
      initialDir: 'desc',
      headerClassName: 'w-28',
      cell: (transaction) => (
        <span className="text-sm whitespace-nowrap text-foreground-muted">{formatDate(transaction.date)}</span>
      ),
    },
    {
      id: 'description',
      header: 'Libellé',
      sortable: true,
      fallbackKey: 'date',
      fallbackDir: 'desc',
      cell: (transaction) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {transaction.description ?? 'Sans libellé'}
            </span>
            {transaction.isRecurring ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                title="Charge fixe / récurrente"
              >
                <Repeat className="h-3 w-3" />
                Fixe
              </span>
            ) : null}
          </div>
          <Caption className="mt-0.5 block">{paymentMethodLabels[transaction.paymentMethod]}</Caption>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Catégorie',
      sortable: true,
      fallbackKey: 'date',
      fallbackDir: 'desc',
      headerClassName: 'w-44',
      cell: (transaction) =>
        transaction.category ? (
          <CategoryBadge
            name={transaction.category.name}
            icon={transaction.category.icon}
            color={transaction.category.color}
          />
        ) : (
          <Caption>—</Caption>
        ),
    },
    {
      id: 'account',
      header: 'Compte',
      sortable: true,
      fallbackKey: 'date',
      fallbackDir: 'desc',
      headerClassName: 'w-40',
      cell: (transaction) => (
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
          <span className="truncate">{transaction.account.name}</span>
          {transaction.type === TransactionType.TRANSFER && transaction.toAccount ? (
            <>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
              <span className="truncate">{transaction.toAccount.name}</span>
            </>
          ) : null}
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      sortable: true,
      fallbackKey: 'date',
      fallbackDir: 'desc',
      headerClassName: 'w-28',
      cell: (transaction) => (
        <span className={cn('text-sm font-bold', typeToneClasses[transaction.type])}>
          {transactionTypeLabels[transaction.type]}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Montant',
      sortable: true,
      fallbackKey: 'date',
      fallbackDir: 'desc',
      initialDir: 'desc',
      align: 'right',
      headerClassName: 'w-36',
      cell: (transaction) => {
        const sign =
          transaction.type === TransactionType.INCOME
            ? '+'
            : transaction.type === TransactionType.EXPENSE
              ? '\u2212'
              : ''
        return (
          <span className={cn('text-sm font-bold whitespace-nowrap', typeToneClasses[transaction.type])}>
            {sign}
            {formatMoney(transaction.amount, currency)}
          </span>
        )
      },
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Heading as="h1" size="xl">
            Transactions
          </Heading>
          <Caption className="mt-1 block">
            {totalCount} écriture{totalCount > 1 ? 's' : ''} correspondant aux filtres
          </Caption>
        </div>
        <Button onClick={() => patch({ modal: 'transaction' })} className="shrink-0">
          <Plus className="h-4 w-4" />
          Nouvelle transaction
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <Caption weight="bold" className="tracking-wide uppercase">
            Revenus filtrés
          </Caption>
          <Text size="lg" weight="bold" className="mt-1 truncate text-income">
            + {formatMoney(totals.income, currency)}
          </Text>
        </Card>
        <Card className="p-4">
          <Caption weight="bold" className="tracking-wide uppercase">
            Dépenses filtrées
          </Caption>
          <Text size="lg" weight="bold" className="mt-1 truncate text-expense">
            &minus; {formatMoney(totals.expense, currency)}
          </Text>
        </Card>
        <Card className="p-4">
          <Caption weight="bold" className="tracking-wide uppercase">
            Solde net
          </Caption>
          <Text size="lg" weight="bold" className={cn('mt-1 truncate', totals.net < 0 ? 'text-expense' : 'text-income')}>
            {formatMoney(totals.net, currency)}
          </Text>
        </Card>
      </section>

      <FiltersPanel
        state={draft}
        options={options}
        onChange={handleChange}
        onReset={handleReset}
        hasActiveFilters={hasActiveFilters}
      />

      <DataTable
        rows={transactions}
        columns={columns}
        rowKey={(transaction) => transaction.publicId}
        totalCount={totalCount}
        currentPage={currentPage}
        limit={limit}
        itemNoun="transaction"
        itemNounPlural="transactions"
        minWidth="min-w-[56rem]"
        emptyTitle="Aucune transaction"
        emptyHint="Ajustez vos filtres ou enregistrez une nouvelle transaction."
        actions={(transaction) => {
          const busy = pendingId === transaction.publicId
          return (
            <>
              <IconButton
                label="Modifier"
                disabled={busy}
                onClick={() => patch({ edit: transaction.publicId, modal: null })}
              >
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton
                label="Supprimer"
                tone="danger"
                disabled={busy}
                onClick={() => void handleDelete(transaction.publicId)}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </>
          )
        }}
      />
    </div>
  )
}
