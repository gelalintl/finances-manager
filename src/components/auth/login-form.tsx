'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InputField } from '@/components/ui/input'
import { Text } from '@/components/ui/typography'

export function LoginForm({ callbackUrl = '/dashboard' }: { callbackUrl?: string }) {
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
      username: String(form.get('username') ?? ''),
      password: String(form.get('password') ?? ''),
      redirect: false,
    })

    setLoading(false)

    if (!result || result.error) {
      setError('Identifiant ou mot de passe incorrect.')
      return
    }

    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InputField
          id="username"
          name="username"
          type="text"
          label="Email ou Pseudo"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <InputField
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          label="Mot de passe"
          autoComplete="current-password"
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

        <Text variant="muted" size="sm" className="text-center">
          Pas encore de compte ?{' '}
          <Link href="/register" className="font-bold text-primary hover:underline">
            Créer un compte
          </Link>
        </Text>
      </form>
    </Card>
  )
}
