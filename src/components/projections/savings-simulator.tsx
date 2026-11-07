'use client'

import { useMemo, useState } from 'react'
import { PiggyBank } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { InputField } from '@/components/ui/input'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { formatLongDate } from '@/lib/dates'
import { parseAmount, formatMoney } from '@/lib/money'
import { savingsPlan } from '@/lib/projections'

type SavingsSimulatorProps = {
  currency: string
}

export function SavingsSimulator({ currency }: SavingsSimulatorProps) {
  const [target, setTarget] = useState('')
  const [capacity, setCapacity] = useState('')

  const plan = useMemo(() => {
    const targetAmount = parseAmount(target)
    const monthly = parseAmount(capacity)
    if (targetAmount === null || monthly === null) return null
    return savingsPlan(targetAmount, monthly)
  }, [target, capacity])

  return (
    <Card className="p-5">
      <Heading as="h2" size="lg" className="flex items-center gap-2">
        <PiggyBank className="h-4 w-4 text-primary" />
        Simulateur d&apos;épargne
      </Heading>
      <Caption className="mt-1 block">
        Indiquez un montant cible et ce que vous pouvez mettre de côté chaque mois.
      </Caption>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <InputField
          name="target"
          label="Montant cible à épargner"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="500 000"
          trailing={<span className="text-xs font-bold">{currency}</span>}
        />
        <InputField
          name="capacity"
          label="Capacité mensuelle"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          placeholder="50 000"
          trailing={<span className="text-xs font-bold">{currency}</span>}
        />
      </div>

      <div className="mt-4 rounded-2xl bg-background px-4 py-3">
        {plan === null ? (
          <Text variant="muted" size="sm">
            Saisissez les deux montants pour estimer la durée.
          </Text>
        ) : plan.months === 0 ? (
          <Text size="sm" weight="bold">
            Objectif déjà atteint.
          </Text>
        ) : !plan.reachable || plan.months === null || plan.date === null ? (
          <Text size="sm" weight="bold" className="text-warning">
            Indiquez une capacité mensuelle supérieure à 0.
          </Text>
        ) : (
          <>
            <Text size="sm" weight="bold">
              {plan.months} mois
            </Text>
            <Caption className="mt-1 block">
              Date théorique : {formatLongDate(plan.date)}
              {parseAmount(capacity) !== null
                ? ` · ${formatMoney(parseAmount(capacity) ?? 0, currency)} par mois`
                : ''}
            </Caption>
          </>
        )}
      </div>
    </Card>
  )
}
