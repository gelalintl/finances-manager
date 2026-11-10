import type { Metadata } from 'next'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { UserRole } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { ResetPasswordButton } from '@/components/users/reset-password-button'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { formatDate } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/user-context'
import { cn } from '@/lib/cn'

export const metadata: Metadata = {
  title: 'PF | Utilisateurs',
}

const roleLabels: Record<UserRole, string> = {
  USER: 'Utilisateur',
  ADMIN: 'Administrateur',
  SUPER_ADMIN: 'Super admin',
}

/**
 * Annuaire des inscrits. Volontairement limité à l'identité du compte :
 * aucune relation financière (comptes, transactions, catégories, dettes) n'est chargée.
 */
export default async function UsersPage() {
  const admin = await requireSuperAdmin()

  const users = await prisma.user.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: { publicId: true, pseudo: true, email: true, createdAt: true, role: true, mustChangePassword: true },
  })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header>
        <Heading as="h1" size="xl">
          Utilisateurs
        </Heading>
        <Caption className="mt-1 block">
          {users.length} inscrit{users.length > 1 ? 's' : ''}
        </Caption>
      </header>

      <div className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <Text size="sm" className="text-foreground">
          Confidentialité : seuls le pseudo, l&apos;email, la date d&apos;inscription et le rôle sont visibles. Les
          soldes, comptes et transactions de chaque inscrit restent strictement privés.
        </Text>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left">
            <thead className="border-b border-subtle-border bg-background/60">
              <tr className="text-xs font-bold tracking-wide text-foreground-muted uppercase">
                <th className="px-4 py-3">Pseudo</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Inscription</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle-border">
              {users.map((user) => (
                <tr key={user.publicId} className="text-sm">
                  <td className="px-4 py-3">
                    <span className="font-bold text-foreground">{user.pseudo}</span>
                    {user.mustChangePassword ? (
                      <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-bold text-warning">
                        <KeyRound className="h-3 w-3" />
                        Mot de passe provisoire
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">{user.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground-muted">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-bold',
                        user.role === UserRole.USER ? 'bg-foreground/5 text-foreground-muted' : 'bg-primary/10 text-primary',
                      )}
                    >
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.publicId === admin.publicId ? (
                      <Caption>Vous</Caption>
                    ) : (
                      <ResetPasswordButton userId={user.publicId} pseudo={user.pseudo} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
