'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { CategoryType, Frequency, TransactionType } from '@prisma/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { AmountInput } from '@/components/ui/amount-input'
import { InputField, SelectField, labelClass } from '@/components/ui/input'
import { CategoryIcon } from '@/components/ui/category-icon'
import { Caption } from '@/components/ui/typography'
import {
  createRecurring,
  updateRecurring,
  type RecurringFormOptions,
} from '@/app/dashboard/recurring/actions'
import { frequencyLabels, type RecurringListItem } from '@/lib/recurring'
import { transactionTypeLabels } from '@/lib/transactions'
import { toastResult } from '@/lib/notify'
import { useCloseEditor } from '@/lib/search-params'
import { cn } from '@/lib/cn'

type RecurringModalProps = {
  open: boolean
  item: RecurringListItem | null
  options: RecurringFormOptions
  currency: string
  onClose?: () => void
}

const typeChoices: Array<{ id: TransactionType; label: string; active: string }> = [
  {
    id: TransactionType.EXPENSE,
    label: transactionTypeLabels.EXPENSE,
    active: 'border-expense bg-expense/100 text-white',
  },
  {
    id: TransactionType.INCOME,
    label: transactionTypeLabels.INCOME,
    active: 'border-income bg-income/100 text-white',
  },
]

export function RecurringModal(props: RecurringModalProps) {
  const closeEditor = useCloseEditor()
  if (!props.open) return null
  return (
    <RecurringModalForm
      key={props.item?.publicId ?? 'new'}
      {...props}
      onClose={props.onClose ?? closeEditor}
    />
  )
}

function categoriesFor(options: RecurringFormOptions, type: TransactionType) {
  const expected = type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE
  return options.categories.filter((category) => category.type === expected)
}

function RecurringModalForm({
  item,
  options,
  currency,
  onClose,
}: RecurringModalProps & { onClose: () => void }) {
  const editing = item !== null
  const initialType =
    item?.type === TransactionType.INCOME ? TransactionType.INCOME : TransactionType.EXPENSE

  const [label, setLabel] = useState(item?.label ?? '')
  const [type, setType] = useState<TransactionType>(initialType)
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [categoryId, setCategoryId] = useState(item?.category?.publicId ?? '')
  const [accountId, setAccountId] = useState(item?.account.publicId ?? options.accounts[0]?.publicId ?? '')
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? Frequency.MONTHLY)
  const [dayOfMonth, setDayOfMonth] = useState(item ? String(item.dayOfMonth) : '1')
  const [active, setActive] = useState(item?.active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const categories = useMemo(() => {
    const list = categoriesFor(options, type)
    if (item?.category && item.category.type === (type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE)) {
      if (!list.some((category) => category.publicId === item.category?.publicId)) {
        return [...list, item.category]
      }
    }
    return list
  }, [options, type, item])

  const accounts = useMemo(() => {
    if (!item) return options.accounts
    if (options.accounts.some((account) => account.publicId === item.account.publicId)) return options.accounts
    return [...options.accounts, item.account]
  }, [options.accounts, item])

  function selectType(next: TransactionType) {
    setType(next)
    const nextCategories = categoriesFor(options, next)
    setCategoryId(nextCategories[0]?.publicId ?? '')
  }

  function handleClose() {
    if (pending) return
    onClose()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData()
    if (item) formData.set('publicId', item.publicId)
    formData.set('label', label)
    formData.set('type', type)
    formData.set('amount', amount)
    formData.set('categoryId', categoryId)
    formData.set('accountId', accountId)
    formData.set('frequency', frequency)
    formData.set('dayOfMonth', dayOfMonth)
    formData.set('active', String(active))

    setPending(true)
    const result = item ? await updateRecurring(formData) : await createRecurring(formData)
    setPending(false)

    if (!toastResult(result, item ? 'Échéance mise à jour.' : 'Échéance créée.')) {
      if (!result.ok) setError(result.error)
      return
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title={editing ? "Modifier l'échéance" : 'Nouvelle échéance'}
      description="Abonnement, loyer ou revenu versé automatiquement."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
        <InputField
          name="label"
          label="Libellé"
          required
          autoFocus
          maxLength={120}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Loyer, fibre, salaire…"
        />

        <div>
          <span className={labelClass}>Type</span>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type d'échéance">
            {typeChoices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => selectType(choice.id)}
                aria-pressed={type === choice.id}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-bold transition-all duration-200',
                  type === choice.id
                    ? choice.active
                    : 'border-subtle-border bg-surface text-foreground hover:border-primary hover:text-primary',
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>

        <AmountInput name="amount" required autoFocus={false} value={amount} onChange={setAmount} currency={currency} />

        <div>
          <span className={labelClass}>Catégorie</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const selected = category.publicId === categoryId
              return (
                <button
                  key={category.publicId}
                  type="button"
                  onClick={() => setCategoryId(category.publicId)}
                  aria-pressed={selected}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold transition-all duration-200',
                    selected ? 'border-transparent text-white' : 'border-subtle-border hover:border-primary',
                  )}
                  style={
                    selected
                      ? { backgroundColor: category.color }
                      : { color: category.color, backgroundColor: `${category.color}14` }
                  }
                >
                  <CategoryIcon icon={category.icon} className="h-3.5 w-3.5" />
                  {category.name}
                  {selected ? <Check className="h-3 w-3" /> : null}
                </button>
              )
            })}
          </div>
          {categories.length === 0 ? (
            <Caption className="mt-1.5 block">Aucune catégorie disponible pour ce type.</Caption>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            name="accountId"
            label="Compte"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            required
          >
            {accounts.length === 0 ? <option value="">Aucun compte</option> : null}
            {accounts.map((account) => (
              <option key={account.publicId} value={account.publicId}>
                {account.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            name="frequency"
            label="Fréquence"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as Frequency)}
          >
            {Object.entries(frequencyLabels).map(([value, frequencyLabel]) => (
              <option key={value} value={value}>
                {frequencyLabel}
              </option>
            ))}
          </SelectField>
        </div>

        <InputField
          name="dayOfMonth"
          label="Jour du mois"
          type="number"
          min="1"
          max="31"
          step="1"
          required
          value={dayOfMonth}
          onChange={(event) => setDayOfMonth(event.target.value)}
          hint="Borné à la fin du mois lors de la génération (31 → 28 ou 30)."
        />

        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-subtle-border px-3 py-2.5">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-primary"
          />
          <span className="text-sm font-medium text-foreground">
            Échéance active
            <Caption className="block font-normal">
              Seules les échéances actives sont générées automatiquement.
            </Caption>
          </span>
        </label>

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
          <Button type="submit" isLoading={pending} variant={type === TransactionType.INCOME ? 'income' : 'solid'}>
            {editing ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
