import { DashboardShell } from '@/components/layout/dashboard-shell'
import { requireUser } from '@/lib/user-context'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  return (
    <DashboardShell name={user.name} email={user.email}>
      {children}
    </DashboardShell>
  )
}
