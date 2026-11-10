'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Camera, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { removeProfileImage, uploadToSupabase } from '@/app/dashboard/profile/actions'

const ACCEPTED = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 2 * 1024 * 1024

export function AvatarUpload({ pseudo, email, image }: { pseudo: string; email: string; image: string | null }) {
  const router = useRouter()
  const { update } = useSession()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(image)
  const [pending, setPending] = useState(false)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!ACCEPTED.split(',').includes(file.type)) {
      toast.error('Formats acceptés : JPG, PNG ou WebP.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("L'image ne doit pas dépasser 2 Mo.")
      return
    }

    const previous = preview
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)

    const formData = new FormData()
    formData.set('file', file)

    setPending(true)
    const result = await uploadToSupabase(formData)
    setPending(false)
    URL.revokeObjectURL(localUrl)

    if (!result.ok) {
      setPreview(previous)
      toast.error(result.error)
      return
    }

    setPreview(result.url)
    toast.success('Photo de profil mise à jour.')
    await update()
    router.refresh()
  }

  async function handleRemove() {
    setPending(true)
    const result = await removeProfileImage()
    setPending(false)
    if (!result.ok) {
      toast.error(result.error ?? 'La suppression a échoué.')
      return
    }
    setPreview(null)
    toast.success('Photo de profil retirée.')
    await update()
    router.refresh()
  }

  return (
    <Card className="flex flex-col items-center gap-4 p-6 text-center">
      <div className="relative">
        <Avatar name={pseudo} image={preview} size="lg" className={pending ? 'opacity-60' : undefined} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          aria-label="Changer la photo de profil"
          className="absolute right-0 bottom-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-md transition-transform hover:scale-105 disabled:opacity-60"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>
      <div className="min-w-0">
        <Heading as="h2" size="lg" className="truncate">
          {pseudo}
        </Heading>
        <Text variant="muted" size="sm" className="truncate">
          {email}
        </Text>
      </div>

      <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleFile} />

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} isLoading={pending}>
          <Camera className="h-4 w-4" />
          Changer la photo
        </Button>
        {preview ? (
          <Button variant="ghost" size="sm" onClick={() => void handleRemove()} disabled={pending}>
            <Trash2 className="h-4 w-4" />
            Retirer
          </Button>
        ) : null}
      </div>
      <Caption>JPG, PNG ou WebP · 2 Mo maximum</Caption>
    </Card>
  )
}
