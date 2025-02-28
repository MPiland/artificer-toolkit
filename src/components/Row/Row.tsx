import { Children, ReactNode, isValidElement, useCallback, useMemo, useRef, Fragment } from 'react'
import Column from './Column'
import { column_gap, row, row_gap } from './Row.css'
import clsx from 'clsx'
import { useMediaQuery } from 'usehooks-ts'
import { assignInlineVars } from '@vanilla-extract/dynamic'

type ColsAutoType = {
  start: number
  end: number
}

type ColsSetType = {
  lg?: number
  md?: number
  base?: number
}

interface RowProps {
  cols?: ColsAutoType | ColsSetType
  children: ReactNode
  className?: string | number | symbol | any
  onClick?: () => void
  cellSize?: 'full' | 'auto' | 'default'
  rowWidth?: 'full' | 'auto'
  columnGap?: number
  rowGap?: number
  spacing?: 'spaceBetween' | 'spaceAround' | 'flexStart' | 'flexEnd'
  colAlign?: 'start' | 'end' | 'center'
}

const flattenChildren = (children: ReactNode): ReactNode[] => {
  const childrenArray: ReactNode[] = []

  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      if (child.type === Fragment) {
        const fragmentChild = child as React.ReactElement<{ children: ReactNode }>
        childrenArray.push(...flattenChildren(fragmentChild.props.children))
      } else {
        childrenArray.push(child)
      }
    }
  })

  return childrenArray
}

const Row = ({
  children,
  className,
  cols,
  onClick,
  cellSize = 'default',
  rowWidth = 'full',
  columnGap = 16,
  rowGap = 16,
  spacing = 'flexStart',
  colAlign = 'start',
}: RowProps) => {
  const rowRef = useRef<HTMLDivElement>(null)
  const lg = useMediaQuery('(min-width: 1300px)')
  const md = useMediaQuery('(min-width: 568px) and (max-width: 1300px)')

  const childElements = useMemo(() => flattenChildren(children), [children])

  const totalChildren = childElements.length

  const calculatedWidths = useCallback(() => {
    let startWidth: string = ''
    let middleWidth: string = ''
    let endWidth: string = ''
    let columnWidth: string = ''
    let colCount = totalChildren

    if (cols && 'start' in cols) {
      colCount -= cols.start ? 1 : 0
      colCount -= cols.end ? 1 : 0

      endWidth = `${cols.end * 2.25}rem`
      startWidth = `${cols.start * 2}rem`
      middleWidth = `calc((100% - (${endWidth} + ${startWidth} + (${totalChildren * columnGap}px))) / ${colCount})`
    } else if (cols) {
      const colSet = cols as ColsSetType
      if (lg) {
        if (colSet.lg) {
          columnWidth = `calc((100% - ${columnGap * (colSet.lg - 1)}px) / ${colSet.lg})`
        } else if (colSet.md) {
          columnWidth = `calc((100% - ${columnGap * (colSet.md - 1)}px) / ${colSet.md})`
        } else if (colSet.base) {
          columnWidth = `calc((100% - ${columnGap * (colSet.base - 1)}px)/ ${colSet.base})`
        }
      } else if (md) {
        if (colSet.md) {
          columnWidth = `calc((100% - ${columnGap * (colSet.md - 1)}px) / ${colSet.md})`
        } else if (colSet.base) {
          columnWidth = `calc((100% - ${columnGap * (colSet.base - 1)}px) / ${colSet.base})`
        } else {
          columnWidth = `calc((100% - ${columnGap * 4}px) / 4)`
        }
      } else {
        if (colSet.base) {
          columnWidth = `calc((100% - ${columnGap * (colSet.base - 1)}px) / ${colSet.base})`
        } else {
          columnWidth = `calc((100% - ${columnGap * 2}px) / 2)`
        }
      }
    } else {
      if (lg) {
        columnWidth = `calc((100% - ${columnGap * 5}px) / 5)`
      }
      if (md) {
        columnWidth = `calc((100% - ${columnGap * 4}px) / 4)`
      }
      if (!lg && !md) {
        columnWidth = `calc((100% - ${columnGap * 2}px) / 2)`
      }
    }

    return { startWidth, middleWidth, endWidth, columnWidth }
  }, [totalChildren, cols, lg, md, columnGap])

  const { startWidth, middleWidth, endWidth, columnWidth } = useMemo(() => calculatedWidths(), [calculatedWidths])

  const colWidth = (index: number) => {
    // If using the ColsAutoType (start/end)
    if (cols && 'start' in cols) {
      if (index < (cols as ColsAutoType).start) {
        return startWidth
      } else if (cols && 'end' in cols && index === totalChildren - 1) {
        return endWidth
      } else {
        // For middle columns: respect cellSize
        return cellSize === 'default' ? middleWidth : cellSize
      }
    }
    // If using the ColsSetType or default column logic
    else {
      // When cellSize is auto, use fit-content but preserve the column count
      return cellSize === 'default' ? columnWidth : cellSize
    }
  }

  return (
    <div
      className={clsx({ [className]: className }, row[rowWidth], row[spacing])}
      style={assignInlineVars({ [column_gap]: `${columnGap}px`, [row_gap]: `${rowGap}px` })}
      onClick={onClick && onClick}
      ref={rowRef}
    >
      {childElements?.map((child, index) => {
        return (
          child && (
            <Column key={index} width={colWidth(index)} align={colAlign}>
              {child}
            </Column>
          )
        )
      })}
    </div>
  )
}

export default Row
