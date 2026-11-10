'use client'

import { useState, type Ref } from 'react'
import { InputField } from '@/components/ui/input'
import { parseAmount } from '@/lib/money'

type AmountInputProps = {
  name?: string
  label?: string
  value: string
  onChange: (value: string) => void
  currency: string
  required?: boolean
  autoFocus?: boolean
  hint?: string
  placeholder?: string
  inputRef?: Ref<HTMLInputElement>
}

function formatDraft(value: string) {
  const parsed = parseAmount(value)
  if (parsed === null || value.trim() === '') return ''
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: Number.isInteger(parsed) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(parsed)
}

export function AmountInput({
  name = 'amount',
  label = 'Montant',
  value,
  onChange,
  currency,
  required,
  autoFocus = true,
  hint,
  placeholder = '0',
  inputRef,
}: AmountInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <InputField
      ref={inputRef}
      name={name}
      label={label}
      inputMode="decimal"
      autoFocus={autoFocus}
      required={required}
      value={focused ? value : formatDraft(value)}
      placeholder={placeholder}
      hint={hint}
      trailing={<span className="text-xs font-bold">{currency}</span>}
      onFocus={() => {
        setFocused(true)
        const parsed = parseAmount(value)
        if (parsed !== null) onChange(String(parsed))
      }}
      onBlur={() => {
        setFocused(false)
        const parsed = parseAmount(value)
        if (parsed !== null) onChange(String(parsed))
        else if (value.trim() !== '') onChange('')
      }}
      onChange={(event) => onChange(event.target.value.replace(/[^\d,.\s-]/g, ''))}
    />
  )
}
