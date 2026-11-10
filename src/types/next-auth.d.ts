import type { UserRole } from '@prisma/client'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role?: UserRole
      currency?: string
      pseudo?: string
      mustChangePassword?: boolean
    } & DefaultSession['user']
  }

  interface User {
    role?: UserRole
    currency?: string
    pseudo?: string
    mustChangePassword?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: UserRole
    currency?: string
    pseudo?: string
    mustChangePassword?: boolean
  }
}
