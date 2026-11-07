import { createElement } from 'react'
import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Car,
  CreditCard,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  PiggyBank,
  Plane,
  Repeat,
  Shirt,
  ShoppingCart,
  Smartphone,
  Smile,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Registre explicite : Lucide est volumineux, on n'embarque que les icônes
 * réellement utilisables comme catégorie.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Car,
  CreditCard,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  PiggyBank,
  Plane,
  Repeat,
  Shirt,
  ShoppingCart,
  Smartphone,
  Smile,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Wrench,
  Zap,
}

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS)

export function resolveCategoryIcon(name?: string | null): LucideIcon {
  if (name && name in CATEGORY_ICONS) return CATEGORY_ICONS[name]
  return Wallet
}

type CategoryIconProps = {
  icon?: string | null
  className?: string
}

export function CategoryIcon({ icon, className }: CategoryIconProps) {
  // `createElement` plutôt que du JSX : l'icône est résolue dynamiquement dans un
  // registre statique, elle n'est pas un composant créé au rendu.
  return createElement(resolveCategoryIcon(icon), {
    className: cn('h-4 w-4', className),
    'aria-hidden': true,
  })
}

type CategoryBadgeProps = {
  name: string
  icon?: string | null
  color?: string | null
  className?: string
  /** Rend uniquement la pastille d'icône, sans le libellé. */
  compact?: boolean
}

export function CategoryBadge({
  name,
  icon,
  color,
  className,
  compact = false,
}: CategoryBadgeProps) {
  const tint = color || '#64748b'

  if (compact) {
    return (
      <span
        className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg', className)}
        style={{ backgroundColor: `${tint}1f`, color: tint }}
        title={name}
      >
        <CategoryIcon icon={icon} />
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
        className,
      )}
      style={{ backgroundColor: `${tint}1f`, color: tint }}
    >
      <CategoryIcon icon={icon} className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  )
}
