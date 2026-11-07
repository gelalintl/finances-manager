import { TransactionType } from '@prisma/client'
import { exportTransactionsCSV, parseReportPeriod } from '@/lib/reports'
import { getUserContext } from '@/lib/user-context'

export async function GET(request: Request) {
  const ctx = await getUserContext()
  if (!ctx.ok) {
    return new Response('Non autorisé', { status: 401 })
  }

  const url = new URL(request.url)
  const period = parseReportPeriod(url.searchParams.get('year'), url.searchParams.get('month'))
  const typeRaw = url.searchParams.get('type')
  const type =
    typeRaw === TransactionType.INCOME ||
    typeRaw === TransactionType.EXPENSE ||
    typeRaw === TransactionType.TRANSFER
      ? typeRaw
      : 'all'

  const file = await exportTransactionsCSV(ctx.user.id, ctx.user.currency, {
    year: period.year,
    month: period.month,
    type,
  })

  return new Response(file.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
