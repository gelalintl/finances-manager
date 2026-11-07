'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Check } from 'lucide-react'
import { AccountType, CategoryType, PaymentMethod, TransactionType } from '@prisma/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { AmountInput } from '@/components/ui/amount-input'
import { InputField, SelectField, labelClass } from '@/components/ui/input'
import { CategoryIcon } from '@/components/ui/category-icon'
import { Caption } from '@/components/ui/typography'
import {
  createTransaction,
  updateTransaction,
  type TransactionAccountOption,
  type TransactionFormOptions,
  type TransactionRecurringHint,
} from '@/app/dashboard/transactions/actions'
import { accountTypeLabels, NEW_ACCOUNT_OPTION, QUICK_ACCOUNT_TYPES } from '@/lib/accounts'
import { paymentMethodLabels, transactionTypeLabels, type TransactionListItem } from '@/lib/transactions'
import { formatMoney, parseAmount } from '@/lib/money'
import { toDateInput } from '@/lib/dates'
import { useCloseEditor } from '@/lib/search-params'
import { cn } from '@/lib/cn'

type TransactionModalProps = {
  open: boolean
  onClose?: () => void
  transaction?: TransactionListItem | null
  options: TransactionFormOptions
  accounts: TransactionAccountOption[]
  recurringTransactions: TransactionRecurringHint[]
  currency: string
}

/** Moyens de paiement proposés selon la poche choisie. */
const PAYMENT_METHODS_BY_ACCOUNT: Record<AccountType, PaymentMethod[]> = {
  [AccountType.CASH]: [PaymentMethod.CASH],
  [AccountType.MOBILE_MONEY]: [PaymentMethod.MOBILE_MONEY],
  [AccountType.CHECKING]: [PaymentMethod.BANK_TRANSFER, PaymentMethod.CARD, PaymentMethod.CHECK],
  [AccountType.SAVINGS]: [PaymentMethod.BANK_TRANSFER, PaymentMethod.CARD, PaymentMethod.CHECK],
  [AccountType.CARD]: [PaymentMethod.CARD],
}

function paymentMethodsFor(accountType: AccountType) {
  return PAYMENT_METHODS_BY_ACCOUNT[accountType]
}

function accountTypeOf(accounts: TransactionAccountOption[], accountId: string, creating: boolean, newType: AccountType) {
  if (creating) return newType
  return accounts.find((account) => account.publicId === accountId)?.type ?? AccountType.CHECKING
}

const typeChoices: Array<{ id: TransactionType; label: string; active: string }> = [
  { id: TransactionType.EXPENSE, label: transactionTypeLabels.EXPENSE, active: 'border-expense bg-expense/100 text-white' },
  { id: TransactionType.INCOME, label: transactionTypeLabels.INCOME, active: 'border-income bg-income/100 text-white' },
  { id: TransactionType.TRANSFER, label: transactionTypeLabels.TRANSFER, active: 'border-transfer bg-transfer text-white' },
]

/** Catégories compatibles avec un type de transaction donné. */
function categoriesForType(options: TransactionFormOptions, type: TransactionType) {
  if (type === TransactionType.TRANSFER) return []
  const expected = type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE
  return options.categories.filter((category) => category.type === expected)
}

export function TransactionModal({
  open,
  onClose,
  transaction = null,
  options,
  accounts,
  recurringTransactions,
  currency,
}: TransactionModalProps) {
  const closeEditor = useCloseEditor()
  if (!open) return null
  return (
    <TransactionModalForm
      key={transaction?.publicId ?? 'new'}
      transaction={transaction}
      options={options}
      accounts={accounts}
      recurringTransactions={recurringTransactions}
      currency={currency}
      onClose={onClose ?? closeEditor}
    />
  )
}

function TransactionModalForm({
  transaction,
  options,
  accounts,
  recurringTransactions,
  currency,
  onClose,
}: {
  transaction: TransactionListItem | null
  options: TransactionFormOptions
  accounts: TransactionAccountOption[]
  recurringTransactions: TransactionRecurringHint[]
  currency: string
  onClose: () => void
}) {
  const router = useRouter()
  const editing = transaction !== null
  const initialType = transaction?.type ?? TransactionType.EXPENSE

  const [type, setType] = useState<TransactionType>(initialType)
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [categoryId, setCategoryId] = useState(
    transaction?.category?.publicId ?? categoriesForType(options, initialType)[0]?.publicId ?? '',
  )
  const [accountId, setAccountId] = useState(
    transaction?.account.publicId ?? accounts[0]?.publicId ?? NEW_ACCOUNT_OPTION,
  )
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState<AccountType>(AccountType.CHECKING)
  const [toAccountId, setToAccountId] = useState(transaction?.toAccount?.publicId ?? '')
  const openingAccountType = accountTypeOf(
    accounts,
    transaction?.account.publicId ?? accounts[0]?.publicId ?? NEW_ACCOUNT_OPTION,
    !(transaction?.account.publicId ?? accounts[0]?.publicId),
    AccountType.CHECKING,
  )
  const openingMethods = paymentMethodsFor(openingAccountType)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    transaction && openingMethods.includes(transaction.paymentMethod)
      ? transaction.paymentMethod
      : openingMethods[0],
  )
  const [date, setDate] = useState(() => toDateInput(transaction?.date ?? new Date()))
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [isRecurring, setIsRecurring] = useState(transaction?.isRecurring ?? false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const isTransfer = type === TransactionType.TRANSFER
  const creatingAccount = accountId === NEW_ACCOUNT_OPTION

  const categories = useMemo(() => categoriesForType(options, type), [options, type])

  const selectedCategory = categories.find((category) => category.publicId === categoryId) ?? null
  const selectedAccountType = accountTypeOf(accounts, accountId, creatingAccount, newAccountType)
  const allowedMethods = paymentMethodsFor(selectedAccountType)
  const fixedCategoryKey = recurringTransactions
    .map((item) => item.categoryPublicId)
    .filter((id): id is string => Boolean(id))
    .sort()
    .join('|')
  const fixedChargeDetected =
    !isTransfer && isRecurring && categoryId.length > 0 && fixedCategoryKey.split('|').includes(categoryId)

  useEffect(() => {
    if (allowedMethods.length === 1 || !allowedMethods.includes(paymentMethod)) {
      setPaymentMethod(allowedMethods[0])
    }
  }, [allowedMethods, paymentMethod])

  useEffect(() => {
    if (isTransfer || !categoryId) return
    if (fixedCategoryKey.split('|').includes(categoryId)) setIsRecurring(true)
  }, [categoryId, isTransfer, fixedCategoryKey])

  /** Changer de type réaligne immédiatement la catégorie sélectionnée. */
  function selectType(next: TransactionType) {
    setType(next)
    setCategoryId(categoriesForType(options, next)[0]?.publicId ?? '')
  }

  function reset() {
    setType(TransactionType.EXPENSE)
    setAmount('')
    setCategoryId(categoriesForType(options, TransactionType.EXPENSE)[0]?.publicId ?? '')
    const nextAccountId = accounts[0]?.publicId ?? NEW_ACCOUNT_OPTION
    setAccountId(nextAccountId)
    setNewAccountName('')
    setNewAccountType(AccountType.CHECKING)
    setToAccountId('')
    setPaymentMethod(
      paymentMethodsFor(
        accountTypeOf(accounts, nextAccountId, nextAccountId === NEW_ACCOUNT_OPTION, AccountType.CHECKING),
      )[0],
    )
    setDate(toDateInput(new Date()))
    setDescription('')
    setIsRecurring(false)
    setError(null)
  }

  function handleClose() {
    if (pending) return
    reset()
    onClose()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const parsed = parseAmount(amount)
    if (parsed === null || parsed <= 0) {
      setError('Saisissez un montant supérieur à 0.')
      return
    }
    const creatingAccount = accountId === NEW_ACCOUNT_OPTION
    if (!accountId) {
      setError('Choisissez un compte source.')
      return
    }
    if (creatingAccount && !newAccountName.trim()) {
      setError('Indiquez un nom pour le nouveau compte.')
      return
    }
    if (isTransfer && !toAccountId) {
      setError('Choisissez un compte destinataire.')
      return
    }
    if (!isTransfer && !categoryId) {
      setError('Choisissez une catégorie.')
      return
    }

    const formData = new FormData()
    if (transaction) formData.set('publicId', transaction.publicId)
    formData.set('type', type)
    formData.set('amount', String(parsed))
    formData.set('date', date)
    formData.set('description', description)
    formData.set('accountId', accountId)
    if (creatingAccount) {
      formData.set('newAccountName', newAccountName.trim())
      formData.set('newAccountType', newAccountType)
    }
    formData.set('categoryId', categoryId)
    formData.set('toAccountId', toAccountId)
    formData.set('paymentMethod', paymentMethod)
    formData.set('isRecurring', String(!isTransfer && isRecurring))

    setPending(true)
    const result = transaction ? await updateTransaction(formData) : await createTransaction(formData)
    setPending(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    // Garde-fou : l'écriture est enregistrée même en cas de dépassement,
    // on se contente d'alerter l'utilisateur.
    const budget = result.budget
    if (result.exceededBudget && budget) {
      toast.warning(`Budget « ${budget.categoryName} » dépassé`, {
        description: `${formatMoney(budget.spent, currency)} dépensés sur un plafond de ${formatMoney(
          budget.limit,
          currency,
        )} (+${formatMoney(budget.overBy, currency)}).`,
        duration: 8000,
      })
    } else if (budget?.alertReached) {
      toast.warning(`Seuil d'alerte atteint sur « ${budget.categoryName} »`, {
        description: `${Math.round(budget.ratio)} % du plafond consommé, il reste ${formatMoney(
          budget.remaining,
          currency,
        )}.`,
        duration: 7000,
      })
    } else {
      toast.success(editing ? 'Transaction mise à jour.' : 'Transaction enregistrée.')
    }

    reset()
    onClose()
    router.refresh()
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title={editing ? 'Modifier la transaction' : 'Nouvelle transaction'}
      description={
        editing
          ? 'Corrigez le montant, le compte ou la catégorie.'
          : 'Saisie rapide : montant, type, catégorie, compte.'
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
        {/* --- Type --- */}
        <div>
          <span className={labelClass}>Type</span>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Type de transaction">
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

        {/* --- Montant --- */}
        {/* Saisie ultra-rapide : le montant prend le focus dès l'ouverture. */}
        <AmountInput
          name="amount"
          label="Montant"
          required
          value={amount}
          onChange={setAmount}
          currency={currency}
        />

        {/* --- Catégorie (badges couleur + icône) --- */}
        {!isTransfer ? (
          <div>
            <span className={labelClass}>Catégorie</span>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const active = category.publicId === categoryId
                return (
                  <button
                    key={category.publicId}
                    type="button"
                    onClick={() => setCategoryId(category.publicId)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold transition-all duration-200',
                      active ? 'border-transparent text-white' : 'border-subtle-border text-foreground hover:border-primary',
                    )}
                    style={
                      active
                        ? { backgroundColor: category.color }
                        : { color: category.color, backgroundColor: `${category.color}14` }
                    }
                  >
                    <CategoryIcon icon={category.icon} className="h-3.5 w-3.5" />
                    {category.name}
                    {active ? <Check className="h-3 w-3" /> : null}
                  </button>
                )
              })}
            </div>
            {selectedCategory ? null : (
              <Caption className="mt-1.5 block">Aucune catégorie disponible pour ce type.</Caption>
            )}
          </div>
        ) : null}

        {/* --- Comptes --- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <SelectField
              name="accountId"
              label={isTransfer ? 'Depuis le compte' : 'Compte'}
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              required
            >
              {accounts.map((account) => (
                <option key={account.publicId} value={account.publicId}>
                  {account.name}
                </option>
              ))}
              <option value={NEW_ACCOUNT_OPTION}>➕ Ajouter un compte...</option>
            </SelectField>

            {creatingAccount ? (
              <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <InputField
                  name="newAccountName"
                  label="Nom du compte"
                  required
                  autoFocus
                  maxLength={80}
                  value={newAccountName}
                  onChange={(event) => setNewAccountName(event.target.value)}
                  placeholder="Livret A"
                />
                <SelectField
                  name="newAccountType"
                  label="Type"
                  value={newAccountType}
                  onChange={(event) => setNewAccountType(event.target.value as AccountType)}
                  required
                >
                  {QUICK_ACCOUNT_TYPES.map((accountType) => (
                    <option key={accountType} value={accountType}>
                      {accountTypeLabels[accountType]}
                    </option>
                  ))}
                </SelectField>
              </div>
            ) : null}
          </div>

          {isTransfer ? (
            <SelectField
              name="toAccountId"
              label="Vers le compte"
              value={toAccountId}
              onChange={(event) => setToAccountId(event.target.value)}
              required
            >
              <option value="">Sélectionner…</option>
              {accounts
                .filter((account) => account.publicId !== accountId)
                .map((account) => (
                  <option key={account.publicId} value={account.publicId}>
                    {account.name}
                  </option>
                ))}
            </SelectField>
          ) : (
            <SelectField
              name="paymentMethod"
              label="Moyen de paiement"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
            >
              {allowedMethods.map((value) => (
                <option key={value} value={value}>
                  {paymentMethodLabels[value]}
                </option>
              ))}
            </SelectField>
          )}
        </div>

        {/* --- Date + note --- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            name="date"
            label="Date"
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <InputField
            name="description"
            label="Note"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Courses, loyer, salaire…"
            maxLength={160}
          />
        </div>

        {!isTransfer ? (
          <label
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
              fixedChargeDetected
                ? 'border-income bg-income/10 text-income'
                : 'border-subtle-border'
            }`}
          >
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(event) => setIsRecurring(event.target.checked)}
              className={`h-4 w-4 cursor-pointer ${fixedChargeDetected ? 'accent-income' : 'accent-primary'}`}
            />
            <span className={`text-sm font-medium ${fixedChargeDetected ? 'text-income' : 'text-foreground'}`}>
              Charge fixe (récurrente)
              <Caption className={`block font-normal ${fixedChargeDetected ? 'text-income' : ''}`}>
                {fixedChargeDetected
                  ? 'Charge fixe détectée'
                  : 'Comptée comme charge fixe dans le reste à vivre.'}
              </Caption>
            </span>
          </label>
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
          <Button type="submit" isLoading={pending} variant={type === TransactionType.INCOME ? 'income' : 'solid'}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
