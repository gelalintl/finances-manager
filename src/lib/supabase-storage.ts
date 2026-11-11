import { parseStoredAvatar } from '@/lib/avatar'

export type StorageConfig = { url: string; key: string; bucket: string }

/** Configuration Storage côté serveur ; `null` tant que la clé service_role n'est pas renseignée. */
export function storageConfig(): StorageConfig | null {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'avatars'
  if (!url || !key) return null
  return { url, key, bucket }
}

function authHeaders(config: StorageConfig) {
  return { Authorization: `Bearer ${config.key}`, apikey: config.key }
}

function objectUrl(config: StorageConfig, bucket: string, path: string, scope: '' | 'authenticated/' = '') {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `${config.url}/storage/v1/object/${scope}${encodeURIComponent(bucket)}/${encodedPath}`
}

export async function uploadObject(config: StorageConfig, path: string, file: File) {
  return fetch(objectUrl(config, config.bucket, path), {
    method: 'POST',
    headers: {
      ...authHeaders(config),
      'Content-Type': file.type,
      'Cache-Control': '3600',
      'x-upsert': 'true',
    },
    body: Buffer.from(await file.arrayBuffer()),
  })
}

/** Lecture avec la clé service_role : fonctionne que le bucket soit public ou privé. */
export async function downloadObject(config: StorageConfig, bucket: string, path: string) {
  return fetch(objectUrl(config, bucket, path, 'authenticated/'), {
    headers: authHeaders(config),
    cache: 'no-store',
  })
}

export async function deleteObject(config: StorageConfig, bucket: string, path: string) {
  await fetch(objectUrl(config, bucket, path), {
    method: 'DELETE',
    headers: authHeaders(config),
  }).catch(() => undefined)
}

/**
 * Objet Storage référencé par `users.image` : format `storage:` actuel, ou ancienne
 * URL publique `/storage/v1/object/public/<bucket>/<path>` du même projet.
 */
export function storedObjectOf(image: string | null, config: StorageConfig) {
  const stored = parseStoredAvatar(image)
  if (stored) return stored
  const prefix = `${config.url}/storage/v1/object/public/`
  if (!image?.startsWith(prefix)) return null
  const rest = image.slice(prefix.length)
  const slash = rest.indexOf('/')
  return slash > 0 ? { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) } : null
}
