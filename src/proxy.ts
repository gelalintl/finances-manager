import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export const proxy = auth((req) => {
  if (req.auth) return NextResponse.next()

  const login = new URL('/login', req.nextUrl.origin)
  login.searchParams.set('callbackUrl', `${req.nextUrl.pathname}${req.nextUrl.search}`)
  return NextResponse.redirect(login)
})

export const config = {
  matcher: ['/dashboard/:path*'],
}
