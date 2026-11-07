import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'personalfinance_dev_secret_key_2026',
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase()
        const password = String(credentials?.password ?? '')
        if (!email || !password) return null

        const user = await prisma.user.findFirst({
          where: { email, isDeleted: false },
        })
        if (!user?.password) return null

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) return null

        return {
          id: user.publicId,
          name: user.name,
          email: user.email,
          role: user.role,
          currency: user.currency,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.currency = user.currency
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id
        if (token.role) session.user.role = token.role as UserRole
        if (typeof token.currency === 'string') session.user.currency = token.currency
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
})
