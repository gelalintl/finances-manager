'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, type DataColumn } from '@/components/ui/data-table'
import { IconButton } from '@/components/ui/icon-button'
import { CategoryIcon } from '@/components/ui/category-icon'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { deleteAccount, setAccountArchived } from '@/app/dashboard/accounts/actions'
import {
  accountFamilyLabels,
  accountTypeIcons,
  accountTypeLabels,
  type AccountListItem,
} from '@/lib/accounts'
import { formatMoney } from '@/lib/money'
import { toastResult } from '@/lib/notify'
import { useSearchPatch } from '@/lib/search-params'
import { cn } from '@/lib/cn'

type AccountWorkspaceProps = {
  accounts: AccountListItem[]
  totalCount: number
  currentPage: number
  limit: number
  archived: boolean
  currency: string
}

export function AccountWorkspace({
  accounts,
  totalCount,
  currentPage,
  limit,
  archived,
  currency,
}: AccountWorkspaceProps) {
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
    params.delete('modal')
    params.delete('edit')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  async function handleArchive(account: AccountListItem) {
    const next = !account.isArchived
    const message = next
      ? `Archiver le compte « ${account.name} » ? Les transactions sont conservées.`
      : `Réactiver le compte « ${account.name} » ?`
    if (!window.confirm(message)) return

    setPendingId(account.publicId)
    const result = await setAccountArchived(account.publicId, next)
    setPendingId(null)
    toastResult(result, next ? 'Compte archivé.' : 'Compte réactivé.')
  }

  async function handleDelete(account: AccountListItem) {
    if (!window.confirm(`Supprimer définitivement le compte « ${account.name} » ?`)) return
    setPendingId(account.publicId)
    const result = await deleteAccount(account.publicId)
    setPendingId(null)
    toastResult(result, 'Compte supprimé.')
  }

  const columns: Array<DataColumn<AccountListItem>> = [
    {
      id: 'name',
      header: 'Compte',
      cell: (account) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CategoryIcon icon={accountTypeIcons[account.type]} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{account.name}</p>
            <Caption className="mt-0.5 block truncate">
              {accountFamilyLabels[account.type]} · {accountTypeLabels[account.type]}
            </Caption>
          </div>
        </div>
      ),
    },
    {
      id: 'institution',
      header: 'Établissement',
      cell: (account) => <span className="text-sm text-foreground">{account.institution ?? '—'}</span>,
    },
    {
      id: 'initial',
      header: 'Solde initial',
      align: 'right',
      cell: (account) => (
        <span className="text-sm whitespace-nowrap text-foreground-muted">
          {formatMoney(account.initialBalance, currency)}
        </span>
      ),
    },
    {
      id: 'balance',
      header: 'Solde actuel',
      align: 'right',
      cell: (account) => (
        <Text
          size="sm"
          weight="bold"
          className={cn('whitespace-nowrap', account.balance < 0 ? 'text-expense' : undefined)}
        >
          {formatMoney(account.balance, currency)}
        </Text>
      ),
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Heading as="h1" size="xl">
            Comptes
          </Heading>
          <Caption className="mt-1 block">
            {totalCount} {totalCount === 1 ? 'compte' : 'comptes'}{' '}
            {archived
              ? totalCount === 1
                ? 'archivé'
                : 'archivés'
              : totalCount === 1
                ? 'actif'
                : 'actifs'}
          </Caption>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={toggleArchived}>
            {archived ? 'Voir les actifs' : 'Voir les archivés'}
          </Button>
          <Button onClick={() => patch({ modal: 'account', edit: null })}>
            <Plus className="h-4 w-4" />
            Ajouter un compte
          </Button>
        </div>
      </header>

      <DataTable
        rows={accounts}
        columns={columns}
        rowKey={(account) => account.publicId}
        totalCount={totalCount}
        currentPage={currentPage}
        limit={limit}
        itemNoun="compte"
        itemNounPlural="comptes"
        minWidth="min-w-[48rem]"
        emptyTitle={archived ? 'Aucun compte archivé' : 'Aucun compte'}
        emptyHint={
          archived
            ? 'Les comptes archivés apparaîtront ici.'
            : 'Ajoutez un compte banque, du cash ou un mobile money.'
        }
        actions={(account) => {
          const busy = pendingId === account.publicId
          return (
            <>
              <IconButton label="Modifier" disabled={busy} onClick={() => patch({ edit: account.publicId, modal: null })}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton
                label={account.isArchived ? 'Réactiver' : 'Archiver'}
                disabled={busy}
                onClick={() => void handleArchive(account)}
              >
                {account.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </IconButton>
              <IconButton label="Supprimer" tone="danger" disabled={busy} onClick={() => void handleDelete(account)}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </>
          )
        }}
      />
    </div>
  )
}
