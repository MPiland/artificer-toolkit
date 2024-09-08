import { Children, ReactNode, isValidElement, useCallback, useMemo, useRef, Fragment } from 'react'
import Column from './Column'
import { row } from './Row.css'
import clsx from 'clsx'
import { useMediaQuery } from 'usehooks-ts'

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
  cellSize?: 'default' | 'auto'
  rowWidth?: 'full' | 'auto'
  columnGap?: number
  rowGap?: number
  spacing?: 'spaceBetween' | 'spaceAround' | 'flexStart' | 'flexEnd'
}

const flattenChildren = (children: ReactNode): ReactNode[] => {
  const childrenArray: ReactNode[] = []

  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      if (child.type === Fragment) {
        childrenArray.push(...flattenChildren(child.props.children))
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
          columnWidth = `calc((100% - ${columnGap * colSet.lg}px) / ${colSet.lg})`
        } else if (colSet.md) {
          console.log({ colSet: colSet.md })
          columnWidth = `calc((100% - ${columnGap * colSet.md}px) / ${colSet.md})`
        } else if (colSet.base) {
          columnWidth = `calc((100% - ${columnGap * colSet.base}px)/ ${colSet.base})`
        }
      } else if (md) {
        if (colSet.md) {
          columnWidth = `calc((100% - ${columnGap * colSet.md}px) / ${colSet.md})`
        } else if (colSet.base) {
          columnWidth = `calc((100% - ${columnGap * colSet.base}px) / ${colSet.base})`
        }
      } else {
        if (colSet.base) {
          columnWidth = `calc((100% - ${columnGap * colSet.base}px) / ${colSet.base})`
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

  return (
    <div
      className={clsx({ [className]: className }, row[rowWidth], row[spacing])}
      onClick={onClick && onClick}
      ref={rowRef}
    >
      {childElements?.map((child, index) => {
        const colWidth =
          cellSize === 'auto'
            ? 'auto'
            : cols && 'start' in cols
            ? index < (cols as ColsAutoType).start
              ? startWidth
              : cols && 'end' in cols && index === totalChildren - 1
              ? endWidth
              : middleWidth
            : columnWidth
        return (
          child && (
            <Column key={index} width={colWidth} columnGap={columnGap} rowGap={rowGap}>
              {child}
            </Column>
          )
        )
      })}
    </div>
  )
}

export default Row
