import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PiggyBank } from 'lucide-react'
import { auth } from '@/auth'
import { LoginForm } from '@/components/auth/login-form'
import { Heading, Text } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: 'PF | Connexion',
}

function safeCallback(value: string | string[] | undefined) {
  const url = Array.isArray(value) ? value[0] : value
  return url && url.startsWith('/dashboard') ? url : '/dashboard'
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth()
  if (session?.user?.id) redirect('/dashboard')
  const params = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white">
            <PiggyBank className="h-6 w-6" />
          </span>
          <Heading as="h1" size="xl">
            PersonalFinance
          </Heading>
          <Text variant="muted" size="sm" className="mt-1">
            Suivez vos budgets et votre reste à vivre
          </Text>
        </div>

        <LoginForm callbackUrl={safeCallback(params.callbackUrl)} />
      </div>
    </main>
  )
}
