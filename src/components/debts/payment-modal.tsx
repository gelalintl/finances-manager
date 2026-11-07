'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { AmountInput } from '@/components/ui/amount-input'
import { InputField, SelectField } from '@/components/ui/input'
import { recordDebtPayment } from '@/app/dashboard/debts/actions'
import { toDateInput } from '@/lib/dates'
import type { DebtAccountOption, DebtListItem } from '@/lib/debts'
import { formatMoney } from '@/lib/money'
import { toastResult } from '@/lib/notify'

type PaymentModalProps = {
  open: boolean
  debt: DebtListItem | null
  debts: DebtListItem[]
  accounts: DebtAccountOption[]
  currency: string
  onClose: () => void
}

export function PaymentModal(props: PaymentModalProps) {
  if (!props.open) return null
  return <PaymentModalForm key={props.debt?.publicId ?? 'payment'} {...props} />
}

function PaymentModalForm({ debt, debts, accounts, currency, onClose }: PaymentModalProps) {
  const choices = debts.filter((item) => item.remainingAmount > 0)
  const [debtId, setDebtId] = useState(debt?.publicId ?? choices[0]?.publicId ?? '')
  const selected = choices.find((item) => item.publicId === debtId) ?? debt
  const [amount, setAmount] = useState(selected ? String(selected.remainingAmount) : '')
  const [date, setDate] = useState(toDateInput(new Date()))
  const [accountId, setAccountId] = useState(accounts[0]?.publicId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function handleClose() {
    if (pending) return
    onClose()
  }

  function selectDebt(nextId: string) {
    setDebtId(nextId)
    const next = choices.find((item) => item.publicId === nextId)
    if (next) setAmount(String(next.remainingAmount))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData()
    formData.set('debtId', debtId)
    formData.set('amount', amount)
    formData.set('date', date)
    formData.set('accountId', accountId)

    setPending(true)
    const result = await recordDebtPayment(formData)
    setPending(false)

    if (!toastResult(result, 'Remboursement enregistré.')) {
      if (!result.ok) setError(result.error)
      return
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title="Enregistrer un remboursement"
      description="Une dette sort du compte. Un prêt remboursé entre sur le compte."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
        <SelectField name="debtId" label="Dossier" value={debtId} onChange={(event) => selectDebt(event.target.value)}>
          {choices.length === 0 ? <option value="">Aucun dossier ouvert</option> : null}
          {choices.map((item) => (
            <option key={item.publicId} value={item.publicId}>
              {item.personName} · reste {formatMoney(item.remainingAmount, currency)}
            </option>
          ))}
        </SelectField>

        <AmountInput
          name="amount"
          required
          value={amount}
          onChange={setAmount}
          currency={currency}
          hint={selected ? `Reste dû : ${formatMoney(selected.remainingAmount, currency)}` : undefined}
        />

        <InputField
          name="date"
          label="Date"
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <SelectField
          name="accountId"
          label="Compte"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          {accounts.length === 0 ? <option value="">Aucun compte</option> : null}
          {accounts.map((account) => (
            <option key={account.publicId} value={account.publicId}>
              {account.name}
            </option>
          ))}
        </SelectField>

        {error ? (
          <p className="flex items-start gap-2 rounded-xl bg-expense/10 px-3 py-2.5 text-sm font-medium text-expense">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-subtle-border pt-4">
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" isLoading={pending} disabled={choices.length === 0 || accounts.length === 0}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
