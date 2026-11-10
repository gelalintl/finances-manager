import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'personalfinance_dev_secret_key_2026',
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Email ou Pseudo', type: 'text' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        const username = String(credentials?.username ?? '').trim()
        const password = String(credentials?.password ?? '')
        if (!username || !password) return null

        const user = await prisma.user.findFirst({
          where: {
            isDeleted: false,
            OR: [
              { email: username.toLowerCase() },
              { pseudo: { equals: username, mode: 'insensitive' } },
            ],
          },
        })
        if (!user?.password) return null

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) return null

        return {
          id: user.publicId,
          name: user.name,
          email: user.email,
          pseudo: user.pseudo,
          image: user.image,
          role: user.role,
          currency: user.currency,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role
        token.currency = user.currency
        token.pseudo = user.pseudo
        token.picture = user.image ?? null
        token.mustChangePassword = user.mustChangePassword ?? false
      }
      // Rafraîchi depuis la base, jamais depuis les données envoyées par le client.
      if (trigger === 'update' && token.sub) {
        const fresh = await prisma.user.findFirst({
          where: { publicId: token.sub, isDeleted: false },
          select: {
            name: true,
            email: true,
            pseudo: true,
            image: true,
            role: true,
            currency: true,
            mustChangePassword: true,
          },
        })
        if (fresh) {
          token.mustChangePassword = fresh.mustChangePassword
          token.name = fresh.name
          token.email = fresh.email
          token.pseudo = fresh.pseudo
          token.picture = fresh.image
          token.role = fresh.role
          token.currency = fresh.currency
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id
        if (token.role) session.user.role = token.role as UserRole
        if (typeof token.currency === 'string') session.user.currency = token.currency
        if (typeof token.pseudo === 'string') session.user.pseudo = token.pseudo
        session.user.image = typeof token.picture === 'string' ? token.picture : null
        session.user.mustChangePassword = token.mustChangePassword === true
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
