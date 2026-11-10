'use server'

import { revalidatePath } from 'next/cache'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getUserContext } from '@/lib/user-context'
import { adminResetPasswordSchema, fieldErrors, type FormResult } from '@/lib/validation/auth'

const BCRYPT_ROUNDS = 12
const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

/**
 * Remplace le mot de passe d'un compte par un mot de passe provisoire et impose
 * son changement à la prochaine connexion. Seul le mot de passe est modifié :
 * aucune donnée financière du compte ciblé n'est lue.
 *
 * `userId` est l'identifiant public (`publicId`) du compte ciblé.
 */
export async function resetUserPasswordByAdmin(userId: string, tempPassword: string): Promise<FormResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }
  if (!ADMIN_ROLES.includes(ctx.user.role)) return { ok: false, error: 'Action non autorisée.' }

  const parsed = adminResetPasswordSchema.safeParse({ userId, tempPassword })
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) }

  const target = await prisma.user.findFirst({
    where: { publicId: parsed.data.userId, isDeleted: false },
    select: { id: true, role: true },
  })
  if (!target) return { ok: false, error: 'Utilisateur introuvable.' }
  if (target.id === ctx.user.id) {
    return { ok: false, error: 'Utilisez « Mon profil » pour changer votre propre mot de passe.' }
  }
  if (target.role !== UserRole.USER && ctx.user.role !== UserRole.SUPER_ADMIN) {
    return { ok: false, error: 'Seul un super admin peut réinitialiser un compte administrateur.' }
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      password: await bcrypt.hash(parsed.data.tempPassword, BCRYPT_ROUNDS),
      mustChangePassword: true,
    },
  })

  revalidatePath('/dashboard/users')
  return { ok: true }
}
