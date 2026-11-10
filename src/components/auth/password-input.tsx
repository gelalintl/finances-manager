'use client'

import { useState } from 'react'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { InputField } from '@/components/ui/input'
import { PASSWORD_RULES } from '@/lib/validation/auth'
import { cn } from '@/lib/cn'

type PasswordInputProps = {
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  error?: string
}

export function PasswordInput({ name, label, value, onChange, autoComplete, error }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <InputField
      id={name}
      name={name}
      type={visible ? 'text' : 'password'}
      label={label}
      autoComplete={autoComplete}
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          className="transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  )
}

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1" aria-label="Règles du mot de passe">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(value)
        return (
          <li
            key={rule.label}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium',
              passed ? 'text-income' : 'text-foreground-muted',
            )}
          >
            {passed ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}
