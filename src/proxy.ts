import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { FORCE_PASSWORD_CHANGE_PATH } from '@/lib/auth-routes'

export const proxy = auth((req) => {
  const { pathname, search, origin } = req.nextUrl

  if (!req.auth) {
    const login = new URL('/login', origin)
    if (pathname.startsWith('/dashboard')) login.searchParams.set('callbackUrl', `${pathname}${search}`)
    return NextResponse.redirect(login)
  }

  if (req.auth.user?.mustChangePassword && pathname !== FORCE_PASSWORD_CHANGE_PATH) {
    return NextResponse.redirect(new URL(FORCE_PASSWORD_CHANGE_PATH, origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/dashboard/:path*', '/force-password-change'],
}
