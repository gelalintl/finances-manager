'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Copy, KeyRound, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { InputField } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Text } from '@/components/ui/typography'
import { PasswordRules } from '@/components/auth/password-input'
import { resetUserPasswordByAdmin } from '@/app/dashboard/users/actions'
import { generateTempPassword } from '@/lib/temp-password'
import { passwordSchema } from '@/lib/validation/auth'

type ResetPasswordButtonProps = {
  userId: string
  pseudo: string
}

export function ResetPasswordButton({ userId, pseudo }: ResetPasswordButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function openModal() {
    setTempPassword(generateTempPassword())
    setError(null)
    setOpen(true)
  }

  function close() {
    if (!pending) setOpen(false)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(tempPassword)
      toast.success('Mot de passe copié.')
    } catch {
      toast.error('Copie impossible : sélectionnez le texte manuellement.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = passwordSchema.safeParse(tempPassword)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Mot de passe invalide.')
      return
    }

    setPending(true)
    const result = await resetUserPasswordByAdmin(userId, parsed.data)
    setPending(false)

    if (!result.ok) {
      const message = result.fieldErrors?.tempPassword ?? result.error ?? 'La réinitialisation a échoué.'
      setError(message)
      toast.error(message)
      return
    }

    setOpen(false)
    toast.success(`Mot de passe provisoire défini pour ${pseudo}.`, {
      description: 'Il devra le changer à sa prochaine connexion.',
    })
    router.refresh()
  }

  return (
    <>
      <IconButton label="Réinitialiser le mot de passe" onClick={openModal}>
        <KeyRound className="h-4 w-4" />
      </IconButton>

      <Modal
        open={open}
        onClose={close}
        title="Réinitialiser le mot de passe"
        description={`Compte : ${pseudo}`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5" noValidate>
          <div className="flex flex-col gap-2">
            <InputField
              id="tempPassword"
              name="tempPassword"
              label="Mot de passe provisoire"
              autoComplete="off"
              spellCheck={false}
              className="font-mono tracking-wide"
              value={tempPassword}
              onChange={(event) => {
                setTempPassword(event.target.value)
                setError(null)
              }}
              error={error ?? undefined}
            />
            <PasswordRules value={tempPassword} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setTempPassword(generateTempPassword())}>
              <RefreshCw className="h-4 w-4" />
              Générer
            </Button>
            <Button variant="secondary" size="sm" onClick={copy} disabled={!tempPassword}>
              <Copy className="h-4 w-4" />
              Copier
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <Text size="sm" className="text-foreground">
              L&apos;ancien mot de passe cessera de fonctionner immédiatement. Transmettez ce mot de passe provisoire
              à {pseudo} par un canal sûr : il devra le remplacer dès sa prochaine connexion.
            </Text>
          </div>

          <div className="flex justify-end gap-2 border-t border-subtle-border pt-4">
            <Button variant="ghost" onClick={close} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" isLoading={pending}>
              Réinitialiser
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
