import type { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export type CurrentUser = {
  id: number
  publicId: string
  name: string
  email: string
  role: UserRole
  currency: string
}

export type UserContext = { ok: true; user: CurrentUser } | { ok: false; error: string }

/**
 * Équivalent de `getTenantContext()` de ShopManager : toutes les requêtes
 * métier doivent être cloisonnées par `userId`.
 */
export async function getUserContext(): Promise<UserContext> {
  const session = await auth()
  const publicId = session?.user?.id

  if (!publicId) return { ok: false, error: 'Session invalide.' }

  const user = await prisma.user.findFirst({
    where: { publicId, isDeleted: false },
    select: {
      id: true,
      publicId: true,
      name: true,
      email: true,
      role: true,
      currency: true,
    },
  })

  if (!user) return { ok: false, error: 'Utilisateur introuvable.' }

  return { ok: true, user }
}

/**
 * Utilisateur de la session. Le proxy bloque déjà `/dashboard` sans session ;
 * cette redirection ne couvre qu'un jeton dont le compte a disparu.
 */
export async function requireUser(): Promise<CurrentUser> {
  const ctx = await getUserContext()
  if (!ctx.ok) redirect('/login')
  return ctx.user
}
