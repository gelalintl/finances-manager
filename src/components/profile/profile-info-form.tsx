'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InputField, SelectField } from '@/components/ui/input'
import { Caption, Heading } from '@/components/ui/typography'
import { updateProfile } from '@/app/dashboard/profile/actions'
import {
  fieldErrors,
  GENDERS,
  genderLabels,
  profileSchema,
  type FieldErrors,
} from '@/lib/validation/auth'

export type ProfileValues = {
  email: string
  pseudo: string
  gender: string
  dateOfBirth: string
  phone: string
}

export function ProfileInfoForm({ initial }: { initial: ProfileValues }) {
  const router = useRouter()
  const { update } = useSession()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function set<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const parsed = profileSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})

    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) formData.set(key, value)

    setPending(true)
    const result = await updateProfile(formData)
    setPending(false)

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {})
      setFormError(result.error ?? null)
      return
    }

    toast.success('Profil mis à jour.')
    await update()
    router.refresh()
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <Card className="p-6">
      <Heading as="h2" size="lg">
        Informations personnelles
      </Heading>
      <Caption className="mt-1 block">Votre pseudo et votre email servent tous deux d'identifiant de connexion.</Caption>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
        <InputField
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          value={values.email}
          onChange={(event) => set('email', event.target.value)}
          error={errors.email}
        />
        <InputField
          name="pseudo"
          label="Pseudo"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          required
          value={values.pseudo}
          onChange={(event) => set('pseudo', event.target.value)}
          error={errors.pseudo}
        />
        <SelectField
          name="gender"
          label="Sexe"
          value={values.gender}
          onChange={(event) => set('gender', event.target.value)}
          error={errors.gender}
        >
          <option value="">Non renseigné</option>
          {GENDERS.map((gender) => (
            <option key={gender} value={gender}>
              {genderLabels[gender]}
            </option>
          ))}
        </SelectField>
        <InputField
          name="dateOfBirth"
          type="date"
          label="Date de naissance"
          max={today}
          value={values.dateOfBirth}
          onChange={(event) => set('dateOfBirth', event.target.value)}
          error={errors.dateOfBirth}
        />
        <InputField
          name="phone"
          type="tel"
          label="Téléphone"
          autoComplete="tel"
          placeholder="+229 01 23 45 67 89"
          value={values.phone}
          onChange={(event) => set('phone', event.target.value)}
          error={errors.phone}
          className="sm:col-span-1"
        />

        {formError ? (
          <p className="flex items-start gap-2 rounded-xl bg-expense/10 px-3 py-2.5 text-sm font-medium text-expense sm:col-span-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" isLoading={pending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Card>
  )
}
