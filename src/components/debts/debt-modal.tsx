'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { DebtType } from '@prisma/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { AmountInput } from '@/components/ui/amount-input'
import { InputField, SelectField, controlClass, labelClass } from '@/components/ui/input'
import { createDebt } from '@/app/dashboard/debts/actions'
import { debtTypeLabels, type DebtAccountOption } from '@/lib/debts'
import { toastResult } from '@/lib/notify'

type DebtModalProps = {
  open: boolean
  accounts: DebtAccountOption[]
  currency: string
  onClose: () => void
}

export function DebtModal(props: DebtModalProps) {
  if (!props.open) return null
  return <DebtModalForm key="new-debt" {...props} />
}

function DebtModalForm({ accounts, currency, onClose }: DebtModalProps) {
  const [type, setType] = useState<DebtType>(DebtType.DEBT)
  const [personName, setPersonName] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [debitNow, setDebitNow] = useState(false)
  const [accountId, setAccountId] = useState(accounts[0]?.publicId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function handleClose() {
    if (pending) return
    onClose()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData()
    formData.set('type', type)
    formData.set('personName', personName)
    formData.set('totalAmount', totalAmount)
    formData.set('dueDate', dueDate)
    formData.set('notes', notes)
    formData.set('debitNow', type === DebtType.LENT && debitNow ? 'true' : 'false')
    formData.set('accountId', accountId)

    setPending(true)
    const result = await createDebt(formData)
    setPending(false)

    if (!toastResult(result, type === DebtType.LENT ? 'Prêt enregistré.' : 'Dette enregistrée.')) {
      if (!result.ok) setError(result.error)
      return
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title="Nouveau dossier (Dette / Prêt)"
      description="Une dette est due à quelqu’un. Un prêt est une somme que vous avez avancée."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
        <SelectField
          name="type"
          label="Type"
          value={type}
          onChange={(event) => setType(event.target.value as DebtType)}
        >
          {Object.entries(debtTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

        <InputField
          name="personName"
          label="Personne"
          required
          autoFocus
          maxLength={80}
          value={personName}
          onChange={(event) => setPersonName(event.target.value)}
          placeholder="Créancier ou emprunteur"
        />

        <AmountInput
          name="totalAmount"
          label="Montant total"
          required
          autoFocus={false}
          value={totalAmount}
          onChange={setTotalAmount}
          currency={currency}
        />

        <InputField
          name="dueDate"
          label="Échéance"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          hint="Facultatif. Sert aux alertes des 7 prochains jours."
        />

        <div className="flex flex-col">
          <label htmlFor="notes" className={labelClass}>
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            maxLength={2000}
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={controlClass}
            placeholder="Contexte, conditions…"
          />
        </div>

        {type === DebtType.LENT ? (
          <div className="rounded-2xl bg-background px-4 py-3">
            <label className="flex items-start gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={debitNow}
                onChange={(event) => setDebitNow(event.target.checked)}
              />
              <span>Débiter un compte maintenant (l’argent sort au moment du prêt)</span>
            </label>
            {debitNow ? (
              <div className="mt-3">
                <SelectField
                  name="accountId"
                  label="Compte débité"
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
              </div>
            ) : null}
          </div>
        ) : null}

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
          <Button type="submit" isLoading={pending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
