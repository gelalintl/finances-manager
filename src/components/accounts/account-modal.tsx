'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { AccountType } from '@prisma/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { AmountInput } from '@/components/ui/amount-input'
import { InputField, SelectField } from '@/components/ui/input'
import { Caption } from '@/components/ui/typography'
import { createAccount, updateAccount } from '@/app/dashboard/accounts/actions'
import { accountTypeLabels, type AccountListItem } from '@/lib/accounts'
import { formatMoney } from '@/lib/money'
import { toastResult } from '@/lib/notify'
import { useCloseEditor } from '@/lib/search-params'

type AccountModalProps = {
  open: boolean
  account: AccountListItem | null
  currency: string
  onClose?: () => void
}

export function AccountModal(props: AccountModalProps) {
  const closeEditor = useCloseEditor()
  if (!props.open) return null
  return (
    <AccountModalForm
      key={props.account?.publicId ?? 'new'}
      {...props}
      onClose={props.onClose ?? closeEditor}
    />
  )
}

function AccountModalForm({ account, currency, onClose }: Required<Pick<AccountModalProps, 'onClose'>> & AccountModalProps) {
  const editing = account !== null
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? AccountType.CHECKING)
  const [balance, setBalance] = useState(account ? String(account.initialBalance) : '')
  const [institution, setInstitution] = useState(account?.institution ?? '')
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
    if (account) formData.set('publicId', account.publicId)
    formData.set('name', name)
    formData.set('type', type)
    formData.set('balance', balance)
    formData.set('institution', institution)

    setPending(true)
    const result = account ? await updateAccount(formData) : await createAccount(formData)
    setPending(false)

    if (!toastResult(result, account ? 'Compte mis à jour.' : 'Compte créé.')) {
      if (!result.ok) setError(result.error)
      return
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title={editing ? 'Modifier le compte' : 'Ajouter un compte'}
      description="Le solde initial est le point de départ. Le solde actuel ajoute le journal des transactions."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
        <InputField
          name="name"
          label="Nom"
          required
          autoFocus
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Compte courant, Espèces, Orange Money…"
        />

        <SelectField
          name="type"
          label="Type"
          value={type}
          onChange={(event) => setType(event.target.value as AccountType)}
        >
          {Object.entries(accountTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

        <AmountInput
          name="balance"
          label="Solde initial"
          required
          autoFocus={false}
          value={balance}
          onChange={setBalance}
          currency={currency}
          hint="Réajustez ce montant pour corriger le point de départ, sans créer de transaction."
        />

        {account ? (
          <Caption className="block">
            Solde actuel :{' '}
            <span className="font-bold text-foreground">{formatMoney(account.balance, currency)}</span>
          </Caption>
        ) : null}

        <InputField
          name="institution"
          label="Établissement"
          maxLength={80}
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
          placeholder="BOA, Orange Money…"
        />

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
            {editing ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
