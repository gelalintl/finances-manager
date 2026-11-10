import { z } from 'zod'

export const GENDERS = ['MASCULIN', 'FEMININ'] as const
export type Gender = (typeof GENDERS)[number]

export const genderLabels: Record<Gender, string> = {
  MASCULIN: 'Masculin',
  FEMININ: 'Féminin',
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "L'email est obligatoire.")
  .max(160, 'Email trop long.')
  .pipe(z.email('Adresse email invalide.'))

export const pseudoSchema = z
  .string()
  .trim()
  .min(3, 'Le pseudo doit contenir au moins 3 caractères.')
  .max(30, 'Le pseudo ne peut pas dépasser 30 caractères.')
  .regex(/^[A-Za-z0-9_.-]+$/, 'Lettres, chiffres, point, tiret et underscore uniquement.')
  .refine((value) => !value.includes('@'), 'Le pseudo ne peut pas contenir « @ ».')

export const passwordSchema = z
  .string()
  .min(8, 'Au moins 8 caractères.')
  .max(128, 'Mot de passe trop long.')
  .regex(/[A-Z]/, 'Au moins une majuscule.')
  .regex(/[0-9]/, 'Au moins un chiffre.')
  .regex(/[^A-Za-z0-9]/, 'Au moins un caractère spécial.')

export const registerSchema = z
  .object({
    email: emailSchema,
    pseudo: pseudoSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas.',
  })

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Date invalide.')
  .refine((value) => {
    if (value === '') return true
    const date = new Date(`${value}T00:00:00`)
    return !Number.isNaN(date.getTime()) && date <= new Date() && date.getFullYear() >= 1900
  }, 'La date de naissance doit être passée.')

export const profileSchema = z.object({
  email: emailSchema,
  pseudo: pseudoSchema,
  gender: z.union([z.enum(GENDERS), z.literal('')]),
  dateOfBirth: optionalDate,
  phone: z
    .string()
    .trim()
    .max(30, 'Numéro trop long.')
    .refine((value) => value === '' || /^\+?[0-9 ().-]{6,}$/.test(value), 'Numéro de téléphone invalide.'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Saisissez l'ancien mot de passe."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas.',
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: "Le nouveau mot de passe doit différer de l'ancien.",
  })

export const adminResetPasswordSchema = z.object({
  userId: z.string().trim().min(1, 'Utilisateur introuvable.'),
  tempPassword: passwordSchema,
})

const tempPasswordFields = {
  currentTempPassword: z.string().min(1, 'Saisissez le mot de passe provisoire.'),
  newPassword: passwordSchema,
}

const differsFromTemp = {
  check: (data: { currentTempPassword: string; newPassword: string }) =>
    data.newPassword !== data.currentTempPassword,
  params: {
    path: ['newPassword'],
    message: 'Le nouveau mot de passe doit différer du mot de passe provisoire.',
  },
}

export const completePasswordResetSchema = z
  .object(tempPasswordFields)
  .refine(differsFromTemp.check, differsFromTemp.params)

export const forcePasswordChangeFormSchema = z
  .object({ ...tempPasswordFields, confirmPassword: z.string() })
  .refine(differsFromTemp.check, differsFromTemp.params)
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas.',
  })

export type FieldErrors = Partial<Record<string, string>>

/** Premier message par champ, prêt à afficher sous l'input. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!result[key]) result[key] = issue.message
  }
  return result
}

export type FormResult = { ok: true } | { ok: false; error?: string; fieldErrors?: FieldErrors }

export const PASSWORD_RULES = [
  { label: '8 caractères minimum', test: (value: string) => value.length >= 8 },
  { label: 'Une majuscule', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Un chiffre', test: (value: string) => /[0-9]/.test(value) },
  { label: 'Un caractère spécial', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
]
