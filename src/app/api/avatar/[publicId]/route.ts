import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { downloadObject, storageConfig, storedObjectOf } from '@/lib/supabase-storage'
import { getUserContext } from '@/lib/user-context'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function notFound() {
  return new Response('Introuvable', { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

/** Photo de profil lue dans Supabase Storage avec la clé service_role : le bucket peut rester privé. */
export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const ctx = await getUserContext()
  if (!ctx.ok) return new Response('Non autorisé', { status: 401, headers: { 'Cache-Control': 'no-store' } })

  const { publicId } = await params
  if (publicId !== ctx.user.publicId && ctx.user.role !== UserRole.SUPER_ADMIN) return notFound()

  const config = storageConfig()
  if (!config) return notFound()

  const target =
    publicId === ctx.user.publicId
      ? { image: ctx.user.image }
      : await prisma.user.findFirst({ where: { publicId, isDeleted: false }, select: { image: true } })

  const object = storedObjectOf(target?.image ?? null, config)
  if (!object || !object.path.startsWith(`${publicId}/`)) return notFound()

  const response = await downloadObject(config, object.bucket, object.path)
  const contentType = response.headers.get('content-type')?.split(';')[0] ?? ''
  if (!response.ok || !response.body || !IMAGE_TYPES.has(contentType)) return notFound()

  return new Response(response.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
