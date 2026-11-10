'use server'

import { revalidatePath } from 'next/cache'
import * as bcrypt from 'bcryptjs'
import { unstable_update } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPendingPasswordUser } from '@/lib/user-context'
import { completePasswordResetSchema, fieldErrors, type FormResult } from '@/lib/validation/auth'

const BCRYPT_ROUNDS = 12

export async function completePasswordReset(currentTempPassword: string, newPassword: string): Promise<FormResult> {
  const pending = await getPendingPasswordUser()
  if (!pending) return { ok: false, error: 'Aucun changement de mot de passe en attente.' }

  const parsed = completePasswordResetSchema.safeParse({ currentTempPassword, newPassword })
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) }

  const user = await prisma.user.findUnique({ where: { id: pending.id }, select: { password: true } })
  if (!user) return { ok: false, error: 'Utilisateur introuvable.' }

  const valid = await bcrypt.compare(parsed.data.currentTempPassword, user.password)
  if (!valid) return { ok: false, fieldErrors: { currentTempPassword: 'Mot de passe provisoire incorrect.' } }

  await prisma.user.update({
    where: { id: pending.id },
    data: {
      password: await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS),
      mustChangePassword: false,
    },
  })

  // Déclenche le callback `jwt` (trigger "update"), qui relit `mustChangePassword` en base.
  await unstable_update({})
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}
