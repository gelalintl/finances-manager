import { UserRole } from '@prisma/client'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { requireUser } from '@/lib/user-context'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  return (
    <DashboardShell
      pseudo={user.pseudo}
      email={user.email}
      image={user.image}
      isSuperAdmin={user.role === UserRole.SUPER_ADMIN}
    >
      {children}
    </DashboardShell>
  )
}
