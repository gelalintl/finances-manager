'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Heading, Text } from '@/components/ui/typography'
import { cn } from '@/lib/cn'

type ModalProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Modal({ open, title, description, onClose, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-xl sm:max-w-lg sm:rounded-3xl',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-subtle-border px-6 py-5">
          <div className="min-w-0">
            <Heading as="h2" size="lg">
              {title}
            </Heading>
            {description ? (
              <Text variant="muted" size="sm" className="mt-1">
                {description}
              </Text>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
