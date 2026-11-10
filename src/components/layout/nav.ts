export type NavItem = {
  href: string
  label: string
  /** Nom d'icône Lucide résolu dans la sidebar. */
  icon: string
  exact?: boolean
  superAdminOnly?: boolean
}

export const dashboardNav: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', exact: true },
  { href: '/dashboard/transactions', label: 'Transactions', icon: 'ArrowLeftRight' },
  { href: '/dashboard/accounts', label: 'Comptes', icon: 'Wallet' },
  { href: '/dashboard/categories', label: 'Catégories', icon: 'Tag' },
  { href: '/dashboard/recurring', label: 'Récurrences', icon: 'RefreshCw' },
  { href: '/dashboard/projections', label: 'Projections', icon: 'TrendingUp' },
  { href: '/dashboard/reports', label: 'Rapports & Exports', icon: 'FileText' },
  { href: '/dashboard/debts', label: 'Dettes & Prêts', icon: 'HandCoins' },
]

export const accountNav: NavItem[] = [
  { href: '/dashboard/profile', label: 'Mon profil', icon: 'UserRound' },
  { href: '/dashboard/users', label: 'Utilisateurs', icon: 'Users', superAdminOnly: true },
]

export function visibleAccountNav(isSuperAdmin: boolean) {
  return accountNav.filter((item) => !item.superAdminOnly || isSuperAdmin)
}

export function isActiveNav(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function getSectionTitle(pathname: string) {
  const match = [...dashboardNav, ...accountNav].find((item) => isActiveNav(item, pathname))
  return match?.label ?? 'Tableau de bord'
}
