'use client'

import { useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { CategoryType } from '@prisma/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { AmountInput } from '@/components/ui/amount-input'
import { InputField, labelClass } from '@/components/ui/input'
import { CategoryIcon, CATEGORY_ICON_NAMES } from '@/components/ui/category-icon'
import { createCategory, updateCategory } from '@/app/dashboard/categories/actions'
import { CATEGORY_COLORS, categoryTypeLabels, type CategoryListItem } from '@/lib/categories'
import { toastResult } from '@/lib/notify'
import { useCloseEditor } from '@/lib/search-params'
import { cn } from '@/lib/cn'

type CategoryModalProps = {
  open: boolean
  category: CategoryListItem | null
  currency: string
  onClose?: () => void
}

const typeChoices: Array<{ id: CategoryType; label: string; active: string }> = [
  {
    id: CategoryType.EXPENSE,
    label: categoryTypeLabels.EXPENSE,
    active: 'border-expense bg-expense/100 text-white',
  },
  {
    id: CategoryType.INCOME,
    label: categoryTypeLabels.INCOME,
    active: 'border-income bg-income/100 text-white',
  },
]

export function CategoryModal(props: CategoryModalProps) {
  const closeEditor = useCloseEditor()
  if (!props.open) return null
  return (
    <CategoryModalForm
      key={props.category?.publicId ?? 'new'}
      {...props}
      onClose={props.onClose ?? closeEditor}
    />
  )
}

function CategoryModalForm({
  category,
  currency,
  onClose,
}: CategoryModalProps & { onClose: () => void }) {
  const editing = category !== null
  const [name, setName] = useState(category?.name ?? '')
  const [type, setType] = useState<CategoryType>(category?.type ?? CategoryType.EXPENSE)
  const [icon, setIcon] = useState(category?.icon ?? 'Wallet')
  const [color, setColor] = useState(category?.color ?? '#6366f1')
  const [budgetLimit, setBudgetLimit] = useState(
    category?.budgetLimit === null || category?.budgetLimit === undefined ? '' : String(category.budgetLimit),
  )
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
    if (category) formData.set('publicId', category.publicId)
    formData.set('name', name)
    formData.set('type', type)
    formData.set('icon', icon)
    formData.set('color', color)
    formData.set('budgetLimit', budgetLimit)

    setPending(true)
    const result = category ? await updateCategory(formData) : await createCategory(formData)
    setPending(false)

    if (!toastResult(result, category ? 'Catégorie mise à jour.' : 'Catégorie créée.')) {
      if (!result.ok) setError(result.error)
      return
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title={editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      description="Icône, couleur du badge et plafond mensuel de référence."
      className="sm:max-w-xl"
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
          placeholder="Alimentation, Salaire…"
        />

        <div>
          <span className={labelClass}>Type</span>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type de catégorie">
            {typeChoices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => setType(choice.id)}
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

        <div>
          <span className={labelClass}>Icône</span>
          <div className="grid grid-cols-8 gap-1.5" role="group" aria-label="Registre d'icônes">
            {CATEGORY_ICON_NAMES.map((name) => {
              const selected = name === icon
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-label={name}
                  aria-pressed={selected}
                  onClick={() => setIcon(name)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200',
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-subtle-border text-foreground-muted hover:border-primary hover:text-primary',
                  )}
                >
                  <CategoryIcon icon={name} />
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <span className={labelClass}>Couleur</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Couleur du badge">
            {CATEGORY_COLORS.map((swatch) => {
              const selected = swatch.toLowerCase() === color.toLowerCase()
              return (
                <button
                  key={swatch}
                  type="button"
                  aria-label={swatch}
                  aria-pressed={selected}
                  onClick={() => setColor(swatch)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200',
                    selected ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-105',
                  )}
                  style={{ backgroundColor: swatch }}
                >
                  {selected ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                </button>
              )
            })}
          </div>
        </div>

        <div
          className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          <CategoryIcon icon={icon} className="h-4 w-4" />
          {name.trim() || 'Aperçu'}
        </div>

        <AmountInput
          name="budgetLimit"
          label="Plafond mensuel"
          autoFocus={false}
          value={budgetLimit}
          onChange={setBudgetLimit}
          currency={currency}
          placeholder="Sans plafond"
          hint="Laisser vide pour une catégorie non plafonnée."
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
