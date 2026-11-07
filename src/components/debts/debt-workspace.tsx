'use client'

import { useMemo, useState } from 'react'
import { DebtStatus, DebtType } from '@prisma/client'
import { HandCoins, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/icon-button'
import { StatsCard } from '@/components/dashboard/stats-card'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { DebtModal } from '@/components/debts/debt-modal'
import { PaymentModal } from '@/components/debts/payment-modal'
import { formatDate } from '@/lib/dates'
import { debtStatusLabels, isDebtOpen, type DebtAccountOption, type DebtListItem } from '@/lib/debts'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'

type DebtWorkspaceProps = {
  debts: DebtListItem[]
  accounts: DebtAccountOption[]
  currency: string
}

type Tab = DebtType
type StatusFilter = 'open' | 'paid'

export function DebtWorkspace({ debts, accounts, currency }: DebtWorkspaceProps) {
  const [tab, setTab] = useState<Tab>(DebtType.DEBT)
  const [status, setStatus] = useState<StatusFilter>('open')
  const [createOpen, setCreateOpen] = useState(false)
  const [paymentDebt, setPaymentDebt] = useState<DebtListItem | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)

  const toRepay = debts
    .filter((debt) => debt.type === DebtType.DEBT && isDebtOpen(debt.status))
    .reduce((total, debt) => total + debt.remainingAmount, 0)
  const toRecover = debts
    .filter((debt) => debt.type === DebtType.LENT && isDebtOpen(debt.status))
    .reduce((total, debt) => total + debt.remainingAmount, 0)

  const visible = useMemo(
    () =>
      debts.filter((debt) => {
        if (debt.type !== tab) return false
        return status === 'paid' ? debt.status === DebtStatus.PAID : isDebtOpen(debt.status)
      }),
    [debts, status, tab],
  )

  const openInTab = debts.filter((debt) => debt.type === tab && isDebtOpen(debt.status))

  function openPayment(debt: DebtListItem | null) {
    setPaymentDebt(debt)
    setPaymentOpen(true)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Heading as="h1" size="xl">
            Dettes &amp; prêts
          </Heading>
          <Caption className="mt-1 block">
            Ce que vous devez, et ce qu’on vous doit. Chaque remboursement met à jour le compte choisi.
          </Caption>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openPayment(openInTab[0] ?? null)} disabled={openInTab.length === 0}>
            Enregistrer un remboursement
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouveau dossier
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <StatsCard
          title="Total à rembourser"
          value={formatMoney(toRepay, currency)}
          tone="expense"
          icon={<HandCoins className="h-5 w-5" />}
          hint="Dettes encore ouvertes"
        />
        <StatsCard
          title="Total à recouvrer"
          value={formatMoney(toRecover, currency)}
          tone="income"
          icon={<HandCoins className="h-5 w-5" />}
          hint="Créances encore ouvertes"
        />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-full bg-surface p-1 shadow-sm" role="tablist" aria-label="Type de dossier">
          <TabButton active={tab === DebtType.DEBT} onClick={() => setTab(DebtType.DEBT)}>
            Mes dettes
          </TabButton>
          <TabButton active={tab === DebtType.LENT} onClick={() => setTab(DebtType.LENT)}>
            On me doit
          </TabButton>
        </div>
        <div className="flex rounded-full bg-surface p-1 shadow-sm" role="tablist" aria-label="Statut">
          <TabButton active={status === 'open'} onClick={() => setStatus('open')}>
            En cours
          </TabButton>
          <TabButton active={status === 'paid'} onClick={() => setStatus('paid')}>
            Soldé
          </TabButton>
        </div>
      </div>

      {visible.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <Text weight="bold">{status === 'paid' ? 'Aucun dossier soldé' : 'Aucun dossier en cours'}</Text>
          <Caption className="mt-1 block">
            {tab === DebtType.DEBT
              ? 'Ajoutez une dette due à un tiers.'
              : 'Ajoutez un prêt que vous avez accordé.'}
          </Caption>
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {visible.map((debt) => (
            <li key={debt.publicId}>
              <Card className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Heading as="h2" size="lg" className="truncate">
                      {debt.personName}
                    </Heading>
                    <Caption className="mt-1 line-clamp-2 block">
                      {debt.dueDate ? `Échéance ${formatDate(debt.dueDate)}` : 'Sans échéance'}
                      {debt.notes ? ` · ${debt.notes}` : ''}
                    </Caption>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold',
                      debt.status === DebtStatus.PAID
                        ? 'bg-income/10 text-income'
                        : debt.status === DebtStatus.PARTIAL
                          ? 'bg-warning/10 text-warning'
                          : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {debtStatusLabels[debt.status]}
                  </span>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold">{formatMoney(debt.remainingAmount, currency)} restants</span>
                    <span className="text-foreground-muted">
                      {debt.progress} % · {formatMoney(debt.totalAmount, currency)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        debt.status === DebtStatus.PAID ? 'bg-income/100' : 'bg-primary',
                      )}
                      style={{ width: `${debt.progress}%` }}
                    />
                  </div>
                </div>

                {isDebtOpen(debt.status) ? (
                  <div className="mt-auto flex items-center justify-end gap-1">
                    <IconButton label="Enregistrer un remboursement" onClick={() => openPayment(debt)}>
                      <HandCoins className="h-4 w-4" />
                    </IconButton>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <DebtModal open={createOpen} accounts={accounts} currency={currency} onClose={() => setCreateOpen(false)} />
      <PaymentModal
        open={paymentOpen}
        debt={paymentDebt}
        debts={debts.filter((debt) => debt.type === tab)}
        accounts={accounts}
        currency={currency}
        onClose={() => setPaymentOpen(false)}
      />
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-bold transition-colors',
        active ? 'bg-primary text-white' : 'text-foreground-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
