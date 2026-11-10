import { UserRole } from '@prisma/client'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { FORCE_PASSWORD_CHANGE_PATH } from '@/lib/auth-routes'
import { prisma } from '@/lib/prisma'

export type CurrentUser = {
  id: number
  publicId: string
  name: string
  pseudo: string
  email: string
  image: string | null
  role: UserRole
  currency: string
}

export type UserContext = { ok: true; user: CurrentUser } | { ok: false; error: string }

type SessionUser = CurrentUser & { mustChangePassword: boolean }

async function loadSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  const publicId = session?.user?.id
  if (!publicId) return null

  return prisma.user.findFirst({
    where: { publicId, isDeleted: false },
    select: {
      id: true,
      publicId: true,
      name: true,
      pseudo: true,
      email: true,
      image: true,
      role: true,
      currency: true,
      mustChangePassword: true,
    },
  })
}

function toCurrentUser(user: SessionUser): CurrentUser {
  const { id, publicId, name, pseudo, email, image, role, currency } = user
  return { id, publicId, name, pseudo, email, image, role, currency }
}

/**
 * Équivalent de `getTenantContext()` de ShopManager : toutes les requêtes
 * métier doivent être cloisonnées par `userId`.
 *
 * L'identifiant provient toujours de la session : aucune action n'accepte
 * un `userId` venu du client, quel que soit le rôle.
 *
 * Le drapeau `mustChangePassword` est relu en base : un jeton émis avant une
 * réinitialisation par l'administrateur ne donne plus accès aux données.
 */
export async function getUserContext(): Promise<UserContext> {
  const user = await loadSessionUser()
  if (!user) return { ok: false, error: 'Session invalide.' }
  if (user.mustChangePassword) return { ok: false, error: 'Vous devez changer votre mot de passe.' }
  return { ok: true, user: toCurrentUser(user) }
}

/**
 * Utilisateur de la session. Le proxy bloque déjà `/dashboard` sans session ;
 * ces redirections couvrent un compte disparu ou réinitialisé depuis l'émission du jeton.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await loadSessionUser()
  if (!user) redirect('/login')
  if (user.mustChangePassword) redirect(FORCE_PASSWORD_CHANGE_PATH)
  return toCurrentUser(user)
}

/** Utilisateur de session tenu de remplacer son mot de passe provisoire, ou `null`. */
export async function getPendingPasswordUser() {
  const user = await loadSessionUser()
  return user?.mustChangePassword ? user : null
}

/** Réservé au SUPER_ADMIN ; les autres rôles reçoivent une 404. */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.role !== UserRole.SUPER_ADMIN) notFound()
  return user
}
