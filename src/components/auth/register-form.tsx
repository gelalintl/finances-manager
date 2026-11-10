'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InputField } from '@/components/ui/input'
import { Text } from '@/components/ui/typography'
import { PasswordInput, PasswordRules } from '@/components/auth/password-input'
import { registerUser } from '@/app/register/actions'
import { fieldErrors, registerSchema, type FieldErrors } from '@/lib/validation/auth'

export function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const values = { email, pseudo, password, confirmPassword }
    const parsed = registerSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})

    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) formData.set(key, value)

    setLoading(true)
    const result = await registerUser(formData)
    if (!result.ok) {
      setLoading(false)
      setErrors(result.fieldErrors ?? {})
      setFormError(result.error ?? null)
      return
    }

    const login = await signIn('credentials', {
      username: parsed.data.email,
      password,
      redirect: false,
    })
    setLoading(false)

    if (!login || login.error) {
      toast.success('Compte créé. Connectez-vous pour continuer.')
      router.push('/login')
      return
    }

    toast.success(`Bienvenue ${parsed.data.pseudo} !`)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <InputField
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <InputField
          id="pseudo"
          name="pseudo"
          type="text"
          label="Pseudo"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          required
          value={pseudo}
          onChange={(event) => setPseudo(event.target.value)}
          error={errors.pseudo}
          hint="3 à 30 caractères : lettres, chiffres, point, tiret, underscore."
        />
        <div className="flex flex-col gap-2">
          <PasswordInput
            name="password"
            label="Mot de passe"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            error={errors.password}
          />
          <PasswordRules value={password} />
        </div>
        <PasswordInput
          name="confirmPassword"
          label="Confirmation du mot de passe"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={errors.confirmPassword}
        />

        {formError ? (
          <p className="flex items-start gap-2 rounded-xl bg-expense/10 px-3 py-2.5 text-sm font-medium text-expense">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {formError}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="mt-2 w-full" isLoading={loading}>
          Créer mon compte
        </Button>

        <Text variant="muted" size="sm" className="text-center">
          Déjà inscrit ?{' '}
          <Link href="/login" className="font-bold text-primary hover:underline">
            Se connecter
          </Link>
        </Text>
      </form>
    </Card>
  )
}
