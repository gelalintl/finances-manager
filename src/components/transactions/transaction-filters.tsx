'use client'

import { Search, X } from 'lucide-react'
import { CategoryType, TransactionType } from '@prisma/client'
import { controlClass, labelClass } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { TransactionFormOptions } from '@/app/dashboard/transactions/actions'
import { transactionTypeLabels, type TransactionTypeFilter } from '@/lib/transactions'
import { cn } from '@/lib/cn'

const typeFilters: Array<{ id: TransactionTypeFilter; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: TransactionType.INCOME, label: transactionTypeLabels.INCOME },
  { id: TransactionType.EXPENSE, label: transactionTypeLabels.EXPENSE },
  { id: TransactionType.TRANSFER, label: transactionTypeLabels.TRANSFER },
]

export type FilterState = {
  type: TransactionTypeFilter
  categoryId: string
  accountId: string
  from: string
  to: string
  q: string
}

type TransactionFiltersProps = {
  state: FilterState
  options: TransactionFormOptions
  onChange: (patch: Partial<FilterState>) => void
  onReset: () => void
  hasActiveFilters: boolean
}

export function TransactionFilters({
  state,
  options,
  onChange,
  onReset,
  hasActiveFilters,
}: TransactionFiltersProps) {
  // Le filtre catégorie suit le type sélectionné pour éviter les croisements absurdes.
  const categories =
    state.type === TransactionType.INCOME
      ? options.categories.filter((category) => category.type === CategoryType.INCOME)
      : state.type === TransactionType.EXPENSE
        ? options.categories.filter((category) => category.type === CategoryType.EXPENSE)
        : options.categories

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par type">
            {typeFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => onChange({ type: filter.id, categoryId: '' })}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-bold transition-all duration-200',
                  state.type === filter.id
                    ? 'border-primary bg-primary text-white'
                    : 'border-subtle-border bg-surface text-foreground hover:border-primary hover:text-primary',
                )}
                aria-pressed={state.type === filter.id}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <X className="h-3.5 w-3.5" />
              Réinitialiser
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col sm:col-span-2 lg:col-span-1">
            <label htmlFor="filter-q" className={labelClass}>
              Recherche
            </label>
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-foreground-muted" />
              <input
                id="filter-q"
                type="search"
                value={state.q}
                onChange={(event) => onChange({ q: event.target.value })}
                placeholder="Libellé…"
                className={cn(controlClass, 'pl-9')}
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label htmlFor="filter-category" className={labelClass}>
              Catégorie
            </label>
            <select
              id="filter-category"
              value={state.categoryId}
              onChange={(event) => onChange({ categoryId: event.target.value })}
              className={cn(controlClass, 'cursor-pointer')}
            >
              <option value="">Toutes</option>
              {categories.map((category) => (
                <option key={category.publicId} value={category.publicId}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="filter-account" className={labelClass}>
              Compte
            </label>
            <select
              id="filter-account"
              value={state.accountId}
              onChange={(event) => onChange({ accountId: event.target.value })}
              className={cn(controlClass, 'cursor-pointer')}
            >
              <option value="">Tous</option>
              {options.accounts.map((account) => (
                <option key={account.publicId} value={account.publicId}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="filter-from" className={labelClass}>
              Du
            </label>
            <input
              id="filter-from"
              type="date"
              value={state.from}
              max={state.to || undefined}
              onChange={(event) => onChange({ from: event.target.value })}
              className={cn(controlClass, 'cursor-pointer')}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="filter-to" className={labelClass}>
              Au
            </label>
            <input
              id="filter-to"
              type="date"
              value={state.to}
              min={state.from || undefined}
              onChange={(event) => onChange({ to: event.target.value })}
              className={cn(controlClass, 'cursor-pointer')}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
