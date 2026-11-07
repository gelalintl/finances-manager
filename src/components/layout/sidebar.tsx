'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeftRight,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  FileText,
  HandCoins,
  RefreshCw,
  Tag,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { dashboardNav, isActiveNav } from '@/components/layout/nav'
import { cn } from '@/lib/cn'

const navIcons: Record<string, LucideIcon> = {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tag,
  RefreshCw,
  TrendingUp,
  FileText,
  HandCoins,
  Target,
  Landmark,
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5 py-6', collapsed ? 'justify-center px-2' : 'px-6')}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
        <PiggyBank className="h-5 w-5" />
      </span>
      {collapsed ? null : (
        <div className="min-w-0">
          <p className="truncate font-sans text-sm font-bold text-foreground">PersonalFinance</p>
          <p className="truncate text-xs text-foreground-muted">Finances personnelles</p>
        </div>
      )}
    </div>
  )
}

function NavLinks({ id, collapsed = false }: { id: string; collapsed?: boolean }) {
  const pathname = usePathname()

  return (
    <nav id={id} className="flex flex-1 flex-col gap-1 px-3 pb-6">
      {dashboardNav.map((item) => {
        const Icon = navIcons[item.icon] ?? LayoutDashboard
        const active = isActiveNav(item, pathname)

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              'flex items-center gap-3 rounded-xl py-2.5 text-sm font-bold transition-all duration-200',
              collapsed ? 'justify-center px-2' : 'px-3',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-foreground-muted hover:bg-foreground/5 hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-subtle-border bg-surface transition-[width] duration-200 print:hidden lg:flex',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <Brand collapsed={collapsed} />
      <NavLinks id="dashboard-nav" collapsed={collapsed} />
    </aside>
  )
}

/** Boutons fixes en bas de l'écran, sur téléphone et tablette. */
export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-subtle-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden lg:hidden"
    >
      {dashboardNav.map((item) => {
        const Icon = navIcons[item.icon] ?? LayoutDashboard
        const active = isActiveNav(item, pathname)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-bold transition-colors',
              active ? 'text-primary' : 'text-foreground-muted',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate">{item.label.split(' ')[0]}</span>
          </Link>
        )
      })}
    </nav>
  )
}
