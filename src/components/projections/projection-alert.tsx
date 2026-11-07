'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

type ProjectionAlertProps = {
  crossesZero: boolean
}

export function ProjectionAlert({ crossesZero }: ProjectionAlertProps) {
  const warned = useRef(false)

  useEffect(() => {
    if (!crossesZero || warned.current) return
    warned.current = true
    toast.warning('Projection sous le seuil critique', {
      description: 'Le solde estimé atteint ou passe sous zéro sur l’horizon à 90 jours.',
      duration: 8000,
    })
  }, [crossesZero])

  return null
}
