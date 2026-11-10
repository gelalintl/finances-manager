'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ChevronDown, LogOut, PanelLeft, UserRound, Users } from 'lucide-react'
import { getSectionTitle } from '@/components/layout/nav'
import { Avatar } from '@/components/ui/avatar'
import { Heading, Text } from '@/components/ui/typography'

type HeaderProps = {
  pseudo: string
  email: string
  image: string | null
  isSuperAdmin: boolean
  navExpanded: boolean
  onToggleNav: () => void
}

const menuItemClass =
  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-foreground/5'

export function Header({ pseudo, email, image, isSuperAdmin, navExpanded, onToggleNav }: HeaderProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

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

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Menu du compte"
          className="flex items-center gap-3 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-foreground/5 sm:pl-3"
        >
          <div className="hidden min-w-0 text-right sm:block">
            <Text size="sm" weight="bold" className="truncate">
              {pseudo}
            </Text>
            <Text variant="muted" size="xs" className="truncate">
              {email}
            </Text>
          </div>
          <Avatar name={pseudo} image={image} />
          <ChevronDown className="h-4 w-4 text-foreground-muted" />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 rounded-2xl border border-subtle-border bg-surface p-1.5 shadow-xl"
          >
            <div className="border-b border-subtle-border px-3 pt-1.5 pb-2.5 sm:hidden">
              <Text size="sm" weight="bold" className="truncate">
                {pseudo}
              </Text>
              <Text variant="muted" size="xs" className="truncate">
                {email}
              </Text>
            </div>
            <Link href="/dashboard/profile" role="menuitem" className={menuItemClass}>
              <UserRound className="h-4 w-4 text-foreground-muted" />
              Mon profil
            </Link>
            {isSuperAdmin ? (
              <Link href="/dashboard/users" role="menuitem" className={menuItemClass}>
                <Users className="h-4 w-4 text-foreground-muted" />
                Utilisateurs
              </Link>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut({ callbackUrl: '/login' })}
              className={`${menuItemClass} text-danger hover:bg-danger/10`}
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
