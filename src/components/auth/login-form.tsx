'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InputField } from '@/components/ui/input'
import { Caption } from '@/components/ui/typography'

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    setLoading(true)
    setError(null)

    const result = await signIn('credentials', {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      redirect: false,
    })

    setLoading(false)

    if (!result || result.error) {
      setError('Email ou mot de passe incorrect.')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InputField
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="vous@exemple.com"
          autoComplete="email"
          defaultValue="lelouch@personalfinance.app"
          required
        />
        <InputField
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          label="Mot de passe"
          placeholder="••••••••"
          autoComplete="current-password"
          defaultValue="Admin2026!"
          required
          error={error ?? undefined}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <Button type="submit" size="lg" className="mt-2 w-full" isLoading={loading}>
          Se connecter
        </Button>

        <Caption className="mt-1 text-center">
          Compte administrateur pré-rempli · lelouch@personalfinance.app / Admin2026!
        </Caption>
      </form>
    </Card>
  )
}
