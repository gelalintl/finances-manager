import type { Metadata } from 'next'
import { RecurringModal } from '@/components/recurring/recurring-modal'
import { RecurringWorkspace } from '@/components/recurring/recurring-workspace'
import { requireUser } from '@/lib/user-context'
import { pick, type SearchParams } from '@/lib/params'
import { parseLimit, parsePage } from '@/lib/pagination'
import { getRecurring, getRecurringFormOptions } from './actions'

export const metadata: Metadata = {
  title: 'PF | Récurrences',
}

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await requireUser()
  const params = await searchParams
  const page = parsePage(pick(params, 'page'))
  const limit = parseLimit(pick(params, 'limit'))

  const [result, options] = await Promise.all([
    getRecurring(page, limit, pick(params, 'sort'), pick(params, 'dir')),
    getRecurringFormOptions(),
  ])

  const editing = result.data.find((item) => item.publicId === pick(params, 'edit')) ?? null

  return (
    <>
      <RecurringWorkspace
        items={result.data}
        totalCount={result.totalCount}
        currentPage={result.currentPage}
        limit={limit}
        currency={user.currency}
      />
      <RecurringModal
        open={pick(params, 'modal') === 'recurring' || editing !== null}
        item={editing}
        options={options}
        currency={user.currency}
      />
    </>
  )
}
