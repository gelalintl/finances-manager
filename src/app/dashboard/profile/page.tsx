import type { Metadata } from 'next'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import { PasswordForm } from '@/components/profile/password-form'
import { ProfileInfoForm } from '@/components/profile/profile-info-form'
import { Caption, Heading } from '@/components/ui/typography'
import { avatarSrc } from '@/lib/avatar'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/user-context'
import { toDateInput } from '@/lib/dates'

export const metadata: Metadata = {
  title: 'PF | Mon profil',
}

export default async function ProfilePage() {
  const user = await requireUser()
  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, pseudo: true, gender: true, dateOfBirth: true, phone: true, image: true },
  })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header>
        <Heading as="h1" size="xl">
          Mon profil
        </Heading>
        <Caption className="mt-1 block">Gérez vos informations personnelles, votre photo et votre mot de passe.</Caption>
      </header>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <AvatarUpload
          pseudo={profile.pseudo}
          email={profile.email}
          image={avatarSrc(profile.image, user.publicId)}
        />
        <div className="flex flex-col gap-4">
          <ProfileInfoForm
            initial={{
              email: profile.email,
              pseudo: profile.pseudo,
              gender: profile.gender ?? '',
              dateOfBirth: profile.dateOfBirth ? toDateInput(profile.dateOfBirth) : '',
              phone: profile.phone ?? '',
            }}
          />
          <PasswordForm />
        </div>
      </div>
    </div>
  )
}
