const STORAGE_SCHEME = 'storage:'

export type StoredAvatar = { bucket: string; path: string }

/** Valeur enregistrée dans `users.image` pour un objet Supabase Storage (bucket privé ou public). */
export function toStoredAvatar(bucket: string, path: string) {
  return `${STORAGE_SCHEME}${bucket}/${path}`
}

export function parseStoredAvatar(image: string | null | undefined): StoredAvatar | null {
  if (!image?.startsWith(STORAGE_SCHEME)) return null
  const value = image.slice(STORAGE_SCHEME.length)
  const slash = value.indexOf('/')
  if (slash <= 0 || slash === value.length - 1) return null
  return { bucket: value.slice(0, slash), path: value.slice(slash + 1) }
}

/**
 * URL affichable par `<img>`. Les objets Storage passent par `/api/avatar/…`, qui vérifie
 * la session : le bucket peut rester privé. Le paramètre `v` change à chaque envoi.
 */
export function avatarSrc(image: string | null | undefined, publicId: string): string | null {
  const stored = parseStoredAvatar(image)
  if (stored) {
    const version = stored.path.slice(stored.path.lastIndexOf('/') + 1)
    return `/api/avatar/${encodeURIComponent(publicId)}?v=${encodeURIComponent(version)}`
  }
  return image && /^https?:\/\//.test(image) ? image : null
}
