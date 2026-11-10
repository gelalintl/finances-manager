'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { PasswordInput, PasswordRules } from '@/components/auth/password-input'
import { completePasswordReset } from '@/app/force-password-change/actions'
import { fieldErrors, forcePasswordChangeFormSchema, type FieldErrors } from '@/lib/validation/auth'

const EMPTY = { currentTempPassword: '', newPassword: '', confirmPassword: '' }

export function ForcePasswordForm() {
  const router = useRouter()
  const { update } = useSession()
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const parsed = forcePasswordChangeFormSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})

    setPending(true)
    const result = await completePasswordReset(parsed.data.currentTempPassword, parsed.data.newPassword)
    if (!result.ok) {
      setPending(false)
      setErrors(result.fieldErrors ?? {})
      setFormError(result.error ?? null)
      return
    }

    await update()
    toast.success('Mot de passe mis à jour. Bienvenue !')
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <PasswordInput
          name="currentTempPassword"
          label="Mot de passe provisoire"
          autoComplete="current-password"
          value={values.currentTempPassword}
          onChange={(value) => setValues((current) => ({ ...current, currentTempPassword: value }))}
          error={errors.currentTempPassword}
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
          label="Confirmation du nouveau mot de passe"
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

        <Button type="submit" size="lg" className="mt-2 w-full" isLoading={pending}>
          Enregistrer et continuer
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={pending}
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          Se déconnecter
        </Button>
      </form>
    </Card>
  )
}

/** Recharge le jeton depuis la base puis renvoie vers le tableau de bord. */
export function SessionResync() {
  const router = useRouter()
  const { update } = useSession()

  useEffect(() => {
    let cancelled = false
    update().then(() => {
      if (!cancelled) router.replace('/dashboard')
    })
    return () => {
      cancelled = true
    }
  }, [router, update])

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Spinner className="h-6 w-6 text-primary" />
    </main>
  )
}
