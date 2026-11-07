import type { Metadata } from 'next'
import { TransactionModal } from '@/components/transactions/transaction-modal'
import { TransactionWorkspace } from '@/components/transactions/transaction-workspace'
import type { FilterState } from '@/components/transactions/transaction-filters'
import { requireUser } from '@/lib/user-context'
import { pick, type SearchParams } from '@/lib/params'
import { parseLimit, parsePage } from '@/lib/pagination'
import { parseTypeFilter } from '@/lib/transactions'
import { getTransactionFormOptions, getTransactions } from './actions'

export const metadata: Metadata = {
  title: 'PF | Transactions',
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireUser()
  const params = await searchParams
  const page = parsePage(pick(params, 'page'))
  const limit = parseLimit(pick(params, 'limit'))

  const filters: FilterState = {
    type: parseTypeFilter(pick(params, 'type')),
    categoryId: pick(params, 'categoryId'),
    accountId: pick(params, 'accountId'),
    from: pick(params, 'from'),
    to: pick(params, 'to'),
    q: pick(params, 'q'),
  }

  const [result, options] = await Promise.all([
    getTransactions(page, limit, {
      ...filters,
      sort: pick(params, 'sort'),
      dir: pick(params, 'dir'),
    }),
    getTransactionFormOptions(),
  ])
  const editing = result.data.find((transaction) => transaction.publicId === pick(params, 'edit')) ?? null

  return (
    <>
      <TransactionWorkspace
        transactions={result.data}
        totalCount={result.totalCount}
        currentPage={result.currentPage}
        limit={limit}
        totals={result.totals}
        filters={filters}
        options={options}
        currency={user.currency}
      />
      <TransactionModal
        open={pick(params, 'modal') === 'transaction' || editing !== null}
        transaction={editing}
        options={options}
        accounts={options.accounts}
        recurringTransactions={options.recurringTransactions}
        currency={user.currency}
      />
    </>
  )
}
