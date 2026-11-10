'use server'

import { Prisma, UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { DEFAULT_CATEGORIES } from '@/lib/categories'
import { fieldErrors, registerSchema, type FormResult } from '@/lib/validation/auth'

const BCRYPT_ROUNDS = 12

/** Inscription autonome : rôle USER, catégories par défaut, aucune donnée financière partagée. */
export async function registerUser(formData: FormData): Promise<FormResult> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email') ?? '',
    pseudo: formData.get('pseudo') ?? '',
    password: formData.get('password') ?? '',
    confirmPassword: formData.get('confirmPassword') ?? '',
  })
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) }

  const { email, pseudo, password } = parsed.data

  const [emailTaken, pseudoTaken] = await Promise.all([
    prisma.user.findFirst({ where: { email }, select: { id: true } }),
    prisma.user.findFirst({ where: { pseudo: { equals: pseudo, mode: 'insensitive' } }, select: { id: true } }),
  ])
  if (emailTaken || pseudoTaken) {
    return {
      ok: false,
      fieldErrors: {
        ...(emailTaken ? { email: 'Cet email est déjà utilisé.' } : {}),
        ...(pseudoTaken ? { pseudo: 'Ce pseudo est déjà pris.' } : {}),
      },
    }
  }

  try {
    await prisma.user.create({
      data: {
        email,
        pseudo,
        name: pseudo,
        password: await bcrypt.hash(password, BCRYPT_ROUNDS),
        role: UserRole.USER,
        currency: 'FCFA',
        categories: {
          create: DEFAULT_CATEGORIES.map((category) => ({
            name: category.name,
            type: category.type,
            icon: category.icon,
            color: category.color,
            budgetLimit: category.budgetLimit,
          })),
        },
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'Cet email ou ce pseudo est déjà utilisé.' }
    }
    console.error('Erreur inscription:', error)
    return { ok: false, error: "L'inscription a échoué. Réessayez." }
  }

  return { ok: true }
}
