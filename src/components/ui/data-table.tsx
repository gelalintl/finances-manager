'use client'

import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { SortableHeader } from '@/components/ui/sortable-header'
import { Caption, Text } from '@/components/ui/typography'
import { cn } from '@/lib/cn'
import type { SortDir } from '@/lib/table-sort'

export type DataColumn<T> = {
  id: string
  header: string
  sortable?: boolean
  fallbackKey?: string
  fallbackDir?: SortDir
  initialDir?: SortDir
  align?: 'left' | 'right'
  headerClassName?: string
  cellClassName?: string
  cell: (row: T) => ReactNode
}

type DataTableProps<T> = {
  rows: T[]
  columns: Array<DataColumn<T>>
  rowKey: (row: T) => string
  actions?: (row: T) => ReactNode
  totalCount: number
  currentPage: number
  limit: number
  itemNoun: string
  itemNounPlural: string
  pageParam?: string
  persistSize?: boolean
  emptyTitle: string
  emptyHint: string
  minWidth?: string
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  actions,
  totalCount,
  currentPage,
  limit,
  itemNoun,
  itemNounPlural,
  pageParam,
  persistSize = true,
  emptyTitle,
  emptyHint,
  minWidth,
}: DataTableProps<T>) {
  function pagination(persist: boolean) {
    return (
      <Pagination
        totalCount={totalCount}
        currentPage={currentPage}
        limit={limit}
        persistSize={persist}
        pageParam={pageParam}
        itemNoun={itemNoun}
        itemNounPlural={itemNounPlural}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {pagination(persistSize)}
      {rows.length === 0 ? (
        <Card className="p-10 text-center">
          <Text weight="bold">{emptyTitle}</Text>
          <Caption className="mt-1 block">{emptyHint}</Caption>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className={cn('w-full border-collapse text-left', minWidth)}>
              <thead className="border-b border-subtle-border bg-background/60">
                <tr>
                  {columns.map((column) =>
                    column.sortable ? (
                      <SortableHeader
                        key={column.id}
                        sortKey={column.id}
                        label={column.header}
                        fallbackKey={column.fallbackKey ?? column.id}
                        fallbackDir={column.fallbackDir}
                        initialDir={column.initialDir}
                        className={cn(column.align === 'right' && 'text-right', column.headerClassName)}
                      />
                    ) : (
                      <th
                        key={column.id}
                        className={cn(
                          'px-4 py-3 text-xs font-bold tracking-wide text-foreground-muted uppercase',
                          column.align === 'right' && 'text-right',
                          column.headerClassName,
                        )}
                      >
                        {column.header}
                      </th>
                    ),
                  )}
                  {actions ? (
                    <th className="w-36 px-4 py-3 text-right text-xs font-bold tracking-wide whitespace-nowrap text-foreground-muted uppercase">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className="border-b border-subtle-border/70 transition-colors last:border-0 hover:bg-background/60"
                  >
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn('px-4 py-3', column.align === 'right' && 'text-right', column.cellClassName)}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                    {actions ? (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {pagination(false)}
    </div>
  )
}
