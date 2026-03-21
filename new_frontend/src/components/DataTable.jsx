import { cn } from '../lib/format.js'
import { EmptyState } from './ui.jsx'

export default function DataTable({
  columns,
  rows,
  rowKey = 'id',
  emptyTitle = 'Không có dữ liệu',
  emptyDescription = 'Thử đổi filter hoặc tạo mới dữ liệu.',
  onRowClick,
  selectedKey,
  className,
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className={cn('overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white/60', className)}>
      <div className="grid gap-3 p-3 md:hidden">
        {rows.map((row, index) => {
          const key = typeof rowKey === 'function' ? rowKey(row) : row[rowKey]
          const isSelected = selectedKey !== undefined && selectedKey === key

          return (
            <article
              key={key ?? index}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'rounded-[1.35rem] border border-[var(--line)] bg-white/80 p-4 shadow-[0_18px_32px_-30px_rgba(17,24,39,0.45)]',
                onRowClick ? 'cursor-pointer transition-transform hover:-translate-y-0.5' : '',
                isSelected ? 'border-[rgba(19,93,102,0.28)] bg-[rgba(19,93,102,0.08)]' : '',
              )}
            >
              <div className="space-y-3">
                {columns.map((column) => (
                  <div key={column.key} className="grid gap-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                      {column.label}
                    </p>
                    <div className="text-sm text-[var(--ink)]">
                      {column.render ? column.render(row) : row[column.key]}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)] bg-white/80">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-[var(--muted)]',
                    column.headerClassName,
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const key = typeof rowKey === 'function' ? rowKey(row) : row[rowKey]
              const isSelected = selectedKey !== undefined && selectedKey === key

              return (
                <tr
                  key={key ?? index}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-[var(--line)] last:border-none',
                    onRowClick ? 'cursor-pointer transition-colors hover:bg-[rgba(19,93,102,0.06)]' : '',
                    isSelected ? 'bg-[rgba(19,93,102,0.08)]' : '',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-4 py-3 align-top text-sm text-[var(--ink)]', column.cellClassName)}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
