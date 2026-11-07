'use client'

import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LogOut, PanelLeft } from 'lucide-react'
import { getSectionTitle } from '@/components/layout/nav'
import { Heading, Text } from '@/components/ui/typography'

type HeaderProps = {
  name: string
  email: string
  navExpanded: boolean
  onToggleNav: () => void
}

export function Header({ name, email, navExpanded, onToggleNav }: HeaderProps) {
  const pathname = usePathname()
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-subtle-border bg-surface/90 px-4 py-3.5 backdrop-blur print:hidden sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleNav}
          aria-label={navExpanded ? 'Masquer le menu' : 'Afficher le menu'}
          aria-expanded={navExpanded}
          aria-controls="dashboard-nav"
          title={navExpanded ? 'Masquer le menu' : 'Afficher le menu'}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-foreground/5 hover:text-foreground lg:inline-flex"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
        <Heading as="h2" size="lg" className="truncate">
          {getSectionTitle(pathname)}
        </Heading>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden min-w-0 text-right sm:block">
          <Text size="sm" weight="bold" className="truncate">
            {name}
          </Text>
          <Text variant="muted" size="xs" className="truncate">
            {email}
          </Text>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {initials || 'PF'}
        </span>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: '/login' })}
          aria-label="Se déconnecter"
          title="Se déconnecter"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-foreground/5 hover:text-danger"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
