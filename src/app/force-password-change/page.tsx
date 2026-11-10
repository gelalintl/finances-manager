import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { auth } from '@/auth'
import { ForcePasswordForm, SessionResync } from '@/components/auth/force-password-form'
import { Heading, Text } from '@/components/ui/typography'
import { getPendingPasswordUser } from '@/lib/user-context'

export const metadata: Metadata = {
  title: 'PF | Nouveau mot de passe',
}

export default async function ForcePasswordChangePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const pending = await getPendingPasswordUser()
  if (!pending) {
    // Jeton encore marqué alors que la base ne l'est plus : on resynchronise avant de repartir.
    if (session.user.mustChangePassword) return <SessionResync />
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white">
            <KeyRound className="h-6 w-6" />
          </span>
          <Heading as="h1" size="xl">
            Nouveau mot de passe
          </Heading>
          <Text variant="muted" size="sm" className="mt-1">
            Bonjour {pending.pseudo}, votre mot de passe a été réinitialisé par un administrateur. Choisissez-en un
            nouveau pour accéder à votre espace.
          </Text>
        </div>

        <ForcePasswordForm />
      </div>
    </main>
  )
}
