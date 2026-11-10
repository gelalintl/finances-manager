import { cn } from '@/lib/cn'

type AvatarProps = {
  name: string
  image?: string | null
  size?: 'sm' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-9 w-9 text-sm',
  lg: 'h-24 w-24 text-2xl',
}

export function initialsOf(name: string) {
  return (
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'PF'
  )
}

export function Avatar({ name, image, size = 'sm', className }: AvatarProps) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className={cn('shrink-0 rounded-full object-cover ring-2 ring-surface', sizes[size], className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary',
        sizes[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
