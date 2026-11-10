'use client'

import { useCallback, useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { BottomNav, Sidebar } from '@/components/layout/sidebar'

const COLLAPSED_KEY = 'pf-sidebar-collapsed'

type DashboardShellProps = {
  pseudo: string
  email: string
  image: string | null
  isSuperAdmin: boolean
  children: React.ReactNode
}

export function DashboardShell({ pseudo, email, image, isSuperAdmin, children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (window.localStorage.getItem(COLLAPSED_KEY) === '1') setCollapsed(true)
  }, [])

  const toggleNav = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsed={collapsed} isSuperAdmin={isSuperAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          pseudo={pseudo}
          email={email}
          image={image}
          isSuperAdmin={isSuperAdmin}
          navExpanded={!collapsed}
          onToggleNav={toggleNav}
        />
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-6">{children}</main>
      </div>
      <BottomNav />
    </div>
  )
}
