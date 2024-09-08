import { ReactNode } from 'react'
import { column, column_gap, column_width, row_gap } from './Column.css'
import { assignInlineVars } from '@vanilla-extract/dynamic'

interface ColumnProps {
  children: ReactNode
  width: string
  columnGap: number
  rowGap: number
}

const Column = ({ children, width, columnGap, rowGap }: ColumnProps) => {
  const colSpacing = `${columnGap / 2}px`
  const rowSpacing = `${rowGap / 2}px`
  return (
    <div
      className={column}
      style={assignInlineVars({ [column_width]: width, [column_gap]: colSpacing, [row_gap]: rowSpacing })}
    >
      {children}
    </div>
  )
}

export default Column
