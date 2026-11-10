import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PiggyBank } from 'lucide-react'
import { auth } from '@/auth'
import { RegisterForm } from '@/components/auth/register-form'
import { Heading, Text } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: 'PF | Inscription',
}

export default async function RegisterPage() {
  const session = await auth()
  if (session?.user?.id) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white">
            <PiggyBank className="h-6 w-6" />
          </span>
          <Heading as="h1" size="xl">
            Créer un compte
          </Heading>
          <Text variant="muted" size="sm" className="mt-1">
            Vos données financières restent privées et visibles de vous seul.
          </Text>
        </div>

        <RegisterForm />
      </div>
    </main>
  )
}
