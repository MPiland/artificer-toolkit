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
  lg?: number | 'auto'
  md?: number | 'auto'
  base?: number | 'auto'
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
  colJustify?: 'start' | 'end' | 'center' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly'
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
  colJustify = 'start',
}: RowProps) => {
  const rowRef = useRef<HTMLDivElement>(null)
  const lg = useMediaQuery('(min-width: 1300px)')
  const md = useMediaQuery('(min-width: 568px) and (max-width: 1300px)')

  const childElements = useMemo(() => flattenChildren(children), [children])

  const totalChildren = childElements.length
  const colAutoLg = `calc((100% - ${columnGap * 4}px) / 5)`
  const colAutoMd = `calc((100% - ${columnGap * 4}px) / 4)`
  const colAutoSm = `calc((100% - ${columnGap * 4}px) / 2)`

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
      const colLg =
        colSet.lg === 'auto'
          ? `calc((100% - ${columnGap * (totalChildren - 1)}px) / ${totalChildren})`
          : `calc((100% - ${columnGap * (colSet.lg - 1)}px) / ${colSet.lg})`
      const colMd =
        colSet.md === 'auto'
          ? `calc((100% - ${columnGap * (totalChildren - 1)}px) / ${totalChildren})`
          : `calc((100% - ${columnGap * (colSet.md - 1)}px) / ${colSet.md})`
      const colBase =
        colSet.base === 'auto'
          ? `calc((100% - ${columnGap * (totalChildren - 1)}px) / ${totalChildren})`
          : `calc((100% - ${columnGap * (colSet.base - 1)}px) / ${colSet.base})`
      if (lg) {
        if (colSet.lg) {
          columnWidth = colLg
        } else if (colSet.md) {
          columnWidth = colMd
        } else if (colSet.base) {
          columnWidth = colBase
        } else {
          columnWidth = colAutoLg
        }
      } else if (md) {
        if (colSet.md) {
          columnWidth = colMd
        } else if (colSet.base) {
          columnWidth = colBase
        } else {
          columnWidth = colAutoMd
        }
      } else {
        if (colSet.base) {
          columnWidth = colBase
        } else {
          columnWidth = colAutoSm
        }
      }
    } else {
      if (lg) {
        columnWidth = colAutoLg
      }
      if (md) {
        columnWidth = colAutoMd
      }
      if (!lg && !md) {
        columnWidth = colAutoSm
      }
    }

    return { startWidth, middleWidth, endWidth, columnWidth }
  }, [totalChildren, cols, lg, md, columnGap, colAutoLg, colAutoMd, colAutoSm])

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
        if (!isValidElement(child)) return child

        // Extract non-DOM props to prevent React warnings
        const element = child as React.ReactElement<{
          className?: string
          style?: React.CSSProperties
          children?: React.ReactNode
        }>

        // Return a Column that wraps the child's content while preserving relevant props
        return (
          <Column
            key={index}
            width={colWidth(index)}
            align={colAlign}
            justify={colJustify}
            className={element.props.className}
            style={element.props.style}
          >
            {element.props.children}
          </Column>
        )
      })}
    </div>
  )
}

export default Row
