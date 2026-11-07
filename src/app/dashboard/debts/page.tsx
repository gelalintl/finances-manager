import type { Metadata } from 'next'
import { requireUser } from '@/lib/user-context'
import { getDebtWorkspace } from './actions'
import { DebtWorkspace } from '@/components/debts/debt-workspace'

export const metadata: Metadata = {
  title: 'PF | Dettes',
}

export default async function DebtsPage() {
  const user = await requireUser()
  const workspace = await getDebtWorkspace()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <DebtWorkspace debts={workspace.debts} accounts={workspace.accounts} currency={user.currency} />
    </div>
  )
}
