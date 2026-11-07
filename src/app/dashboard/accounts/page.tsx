import type { Metadata } from 'next'
import { AccountModal } from '@/components/accounts/account-modal'
import { AccountWorkspace } from '@/components/accounts/account-workspace'
import { requireUser } from '@/lib/user-context'
import { pick, type SearchParams } from '@/lib/params'
import { parseLimit, parsePage } from '@/lib/pagination'
import { getAccounts } from './actions'

export const metadata: Metadata = {
  title: 'PF | Comptes',
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireUser()
  const params = await searchParams
  const page = parsePage(pick(params, 'page'))
  const limit = parseLimit(pick(params, 'limit'))
  const archived = pick(params, 'archived') === '1'
  const result = await getAccounts(page, limit, archived)
  const editing = result.data.find((account) => account.publicId === pick(params, 'edit')) ?? null

  return (
    <>
      <AccountWorkspace
        accounts={result.data}
        totalCount={result.totalCount}
        currentPage={result.currentPage}
        limit={limit}
        archived={archived}
        currency={user.currency}
      />
      <AccountModal
        open={pick(params, 'modal') === 'account' || editing !== null}
        account={editing}
        currency={user.currency}
      />
    </>
  )
}
