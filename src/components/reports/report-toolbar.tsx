'use client'

import { useRouter } from 'next/navigation'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/input'

const MONTHS = Array.from({ length: 12 }, (_, index) => {
  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(2026, index, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
})

type ReportToolbarProps = {
  year: number
  month: number | null
  years: number[]
}

export function ReportToolbar({ year, month, years }: ReportToolbarProps) {
  const router = useRouter()

  function go(nextYear: number, nextMonth: number | null) {
    const params = new URLSearchParams({
      year: String(nextYear),
      month: nextMonth === null ? 'all' : String(nextMonth),
    })
    router.push(`/dashboard/reports?${params.toString()}`)
  }

  const exportHref = `/api/reports/export?year=${year}&month=${month === null ? 'all' : month}`

  return (
    <div className="no-print flex flex-col gap-4 rounded-2xl border border-subtle-border bg-surface p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Année"
          name="year"
          value={String(year)}
          onChange={(event) => go(Number(event.target.value), month)}
        >
          {years.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Mois"
          name="month"
          value={month === null ? 'all' : String(month)}
          onChange={(event) => {
            const value = event.target.value
            go(year, value === 'all' ? null : Number(value))
          }}
        >
          <option value="all">Année entière</option>
          {MONTHS.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={exportHref}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-primary bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
        >
          <Download className="h-4 w-4" />
          Exporter en CSV
        </a>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimer le rapport / PDF
        </Button>
      </div>
    </div>
  )
}
