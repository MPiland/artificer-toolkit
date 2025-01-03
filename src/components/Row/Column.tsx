import { ReactNode } from 'react'
import { column, column_width } from './Column.css'
import { assignInlineVars } from '@vanilla-extract/dynamic'

interface ColumnProps {
  children: ReactNode
  width: string
}

const Column = ({ children, width }: ColumnProps) => {
  return (
    <div className={column} style={assignInlineVars({ [column_width]: width })}>
      {children}
    </div>
  )
}

export default Column
