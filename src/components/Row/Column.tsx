import { ReactNode } from 'react'
import { column, column_align, column_justify, column_width, column_width_variant } from './Column.css'
import clsx from 'clsx'
import { assignInlineVars } from '@vanilla-extract/dynamic'

interface ColumnProps {
  children: ReactNode
  width: 'auto' | 'full' | string
  align?: 'start' | 'end' | 'center'
  justify?: 'start' | 'end' | 'center' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly'
}

const Column = ({ children, width, align, justify }: ColumnProps) => {
  const isVariant = width === 'auto' || width === 'full'

  const alignStyles = align ? assignInlineVars({ [column_align]: align }) : {}

  const widthStyles = !isVariant ? assignInlineVars({ [column_width]: width }) : {}

  const justifyStyles = assignInlineVars({ [column_justify]: justify })

  return (
    <div
      className={clsx(column, {
        [column_width_variant[width as 'auto' | 'full']]: isVariant,
      })}
      style={{
        ...alignStyles,
        ...widthStyles,
        ...justifyStyles,
      }}
    >
      {children}
    </div>
  )
}

export default Column
