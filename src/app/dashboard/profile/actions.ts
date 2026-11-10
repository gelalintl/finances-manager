'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getUserContext } from '@/lib/user-context'
import {
  changePasswordSchema,
  fieldErrors,
  profileSchema,
  type FormResult,
} from '@/lib/validation/auth'

const BCRYPT_ROUNDS = 12
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function revalidateProfile() {
  revalidatePath('/dashboard', 'layout')
}

export async function updateProfile(formData: FormData): Promise<FormResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const parsed = profileSchema.safeParse({
    email: formData.get('email') ?? '',
    pseudo: formData.get('pseudo') ?? '',
    gender: formData.get('gender') ?? '',
    dateOfBirth: formData.get('dateOfBirth') ?? '',
    phone: formData.get('phone') ?? '',
  })
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) }

  const { email, pseudo, gender, dateOfBirth, phone } = parsed.data
  const self = ctx.user.id

  const [emailTaken, pseudoTaken] = await Promise.all([
    prisma.user.findFirst({ where: { email, id: { not: self } }, select: { id: true } }),
    prisma.user.findFirst({
      where: { pseudo: { equals: pseudo, mode: 'insensitive' }, id: { not: self } },
      select: { id: true },
    }),
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
    await prisma.user.update({
      where: { id: self },
      data: {
        email,
        pseudo,
        name: pseudo,
        gender: gender || null,
        dateOfBirth: dateOfBirth ? new Date(`${dateOfBirth}T12:00:00`) : null,
        phone: phone || null,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'Cet email ou ce pseudo est déjà utilisé.' }
    }
    console.error('Erreur mise à jour profil:', error)
    return { ok: false, error: 'La mise à jour du profil a échoué.' }
  }

  revalidateProfile()
  return { ok: true }
}

export async function changePassword(formData: FormData): Promise<FormResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword') ?? '',
    newPassword: formData.get('newPassword') ?? '',
    confirmPassword: formData.get('confirmPassword') ?? '',
  })
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) }

  const user = await prisma.user.findUnique({
    where: { id: ctx.user.id },
    select: { password: true },
  })
  if (!user) return { ok: false, error: 'Utilisateur introuvable.' }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!valid) return { ok: false, fieldErrors: { currentPassword: 'Ancien mot de passe incorrect.' } }

  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { password: await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS) },
  })

  return { ok: true }
}

function storageConfig() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'avatars'
  if (!url || !key) return null
  return { url, key, bucket }
}

/** Chemin de l'objet si l'URL pointe vers le bucket public configuré. */
function objectPathFromUrl(imageUrl: string | null, base: string, bucket: string) {
  if (!imageUrl) return null
  const prefix = `${base}/storage/v1/object/public/${bucket}/`
  return imageUrl.startsWith(prefix) ? imageUrl.slice(prefix.length) : null
}

/**
 * Envoie la photo de profil dans Supabase Storage puis enregistre son URL publique.
 * Le chemin est dérivé de l'utilisateur de session : impossible d'écrire chez un autre.
 */
export async function uploadToSupabase(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const config = storageConfig()
  if (!config) {
    return {
      ok: false,
      error: 'Stockage non configuré : renseignez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.',
    }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choisissez une image.' }
  const extension = IMAGE_TYPES[file.type]
  if (!extension) return { ok: false, error: 'Formats acceptés : JPG, PNG ou WebP.' }
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "L'image ne doit pas dépasser 2 Mo." }

  const objectPath = `${ctx.user.publicId}/${Date.now()}.${extension}`
  const response = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.key}`,
      apikey: config.key,
      'Content-Type': file.type,
      'Cache-Control': '3600',
      'x-upsert': 'true',
    },
    body: Buffer.from(await file.arrayBuffer()),
  })
  if (!response.ok) {
    console.error('Erreur upload Supabase:', response.status, await response.text().catch(() => ''))
    return { ok: false, error: "L'envoi de l'image a échoué." }
  }

  const publicUrl = `${config.url}/storage/v1/object/public/${config.bucket}/${objectPath}`
  const previous = objectPathFromUrl(ctx.user.image, config.url, config.bucket)

  await prisma.user.update({ where: { id: ctx.user.id }, data: { image: publicUrl } })

  if (previous && previous.startsWith(`${ctx.user.publicId}/`)) {
    await fetch(`${config.url}/storage/v1/object/${config.bucket}/${previous}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${config.key}`, apikey: config.key },
    }).catch(() => undefined)
  }

  revalidateProfile()
  return { ok: true, url: publicUrl }
}

export async function removeProfileImage(): Promise<FormResult> {
  const ctx = await getUserContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const config = storageConfig()
  const previous = config ? objectPathFromUrl(ctx.user.image, config.url, config.bucket) : null

  await prisma.user.update({ where: { id: ctx.user.id }, data: { image: null } })

  if (config && previous && previous.startsWith(`${ctx.user.publicId}/`)) {
    await fetch(`${config.url}/storage/v1/object/${config.bucket}/${previous}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${config.key}`, apikey: config.key },
    }).catch(() => undefined)
  }

  revalidateProfile()
  return { ok: true }
}
