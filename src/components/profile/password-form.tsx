'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Heading } from '@/components/ui/typography'
import { PasswordInput, PasswordRules } from '@/components/auth/password-input'
import { changePassword } from '@/app/dashboard/profile/actions'
import { changePasswordSchema, fieldErrors, type FieldErrors } from '@/lib/validation/auth'

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }

export function PasswordForm() {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const parsed = changePasswordSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})

    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) formData.set(key, value)

    setPending(true)
    const result = await changePassword(formData)
    setPending(false)

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {})
      setFormError(result.error ?? null)
      return
    }

    setValues(EMPTY)
    toast.success('Mot de passe modifié.')
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <Heading as="h2" size="lg">
          Sécurité
        </Heading>
      </div>
      <Caption className="mt-1 block">L&apos;ancien mot de passe est requis pour en définir un nouveau.</Caption>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
        <PasswordInput
          name="currentPassword"
          label="Ancien mot de passe"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={(value) => setValues((current) => ({ ...current, currentPassword: value }))}
          error={errors.currentPassword}
        />
        <div className="flex flex-col gap-2">
          <PasswordInput
            name="newPassword"
            label="Nouveau mot de passe"
            autoComplete="new-password"
            value={values.newPassword}
            onChange={(value) => setValues((current) => ({ ...current, newPassword: value }))}
            error={errors.newPassword}
          />
          <PasswordRules value={values.newPassword} />
        </div>
        <PasswordInput
          name="confirmPassword"
          label="Confirmation"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(value) => setValues((current) => ({ ...current, confirmPassword: value }))}
          error={errors.confirmPassword}
        />

        {formError ? (
          <p className="flex items-start gap-2 rounded-xl bg-expense/10 px-3 py-2.5 text-sm font-medium text-expense">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" isLoading={pending}>
            Changer le mot de passe
          </Button>
        </div>
      </form>
    </Card>
  )
}
