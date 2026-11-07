import {
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Caption, Heading, Text } from '@/components/ui/typography'
import type { AccountSummary } from '@/lib/analytics'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'

const accountIcons: Record<string, LucideIcon> = {
  CHECKING: Landmark,
  SAVINGS: PiggyBank,
  CASH: Banknote,
  MOBILE_MONEY: Smartphone,
  CARD: CreditCard,
}

type AccountsSummaryProps = {
  accounts: AccountSummary[]
  currency: string
  className?: string
}

export function AccountsSummary({ accounts, currency, className }: AccountsSummaryProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-5">
        <Heading as="h3" size="md" weight="bold" className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Mes comptes
        </Heading>
        <Caption className="mt-0.5 block">Soldes calculés depuis le journal</Caption>
      </div>

      {accounts.length === 0 ? (
        <Text variant="muted" size="sm">
          Aucun compte enregistré.
        </Text>
      ) : (
        <ul className="flex flex-col gap-3">
          {accounts.map((account) => {
            const Icon = accountIcons[account.icon] ?? Wallet

            return (
              <li key={account.publicId} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{account.name}</p>
                  <Caption className="block truncate">{account.typeLabel}</Caption>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-sm font-bold',
                    account.balance < 0 ? 'text-expense' : 'text-foreground',
                  )}
                >
                  {formatMoney(account.balance, currency)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
