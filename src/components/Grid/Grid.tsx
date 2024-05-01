import { ReactNode, FC, useLayoutEffect, useState, Children, isValidElement } from 'react'
import { grid, grid_size } from './Grid.css'
import clsx from 'clsx'
import { assignInlineVars } from '@vanilla-extract/dynamic'
import { useMediaQuery } from 'usehooks-ts'
import { size } from '../../css/size.css'

type colsAuto = {
  start: number
  end: number
}

type colsSet = {
  lg?: number
  md?: number
  base?: number
}

interface GridProps {
  cols?: colsAuto | colsSet
  children: ReactNode
  className?: string | number | symbol | any
  onClick?: () => void
}

const Grid: FC<GridProps> = ({ children, className, cols, onClick }) => {
  const [gridSize, setGridSize] = useState<string>('')

  const lg = useMediaQuery('(min-width: 1024px)')
  const md = useMediaQuery('(min-width: 568px) and (max-width: 1023px)')

  useLayoutEffect(() => {
    if (cols) {
      if ('start' in cols) {
        let childCount = 0
        const start = `repeat(${cols.start}, minmax(0, calc(1.25rem * ${cols.start})))`
        const end = `repeat(1, minmax(0, calc(${cols.end} * 2.25rem))`
        Children.forEach(children, (child) => {
          if (isValidElement(child)) {
            childCount += 1
          }
        })
        childCount -= cols.start
        childCount -= cols.end ? 1 : 0
        setGridSize(
          clsx(
            {
              [start]: cols.start !== 0,
            },
            `repeat(${childCount}, minmax(3rem, 1fr))`,
            { [end]: cols.end !== 0 }
          )
        )
      } else {
        // Handle colsSet
        if (lg) {
          if (cols.lg) {
            setGridSize(`repeat(${cols.lg}, minmax(3rem, 1fr))`)
          } else if (cols.base) {
            setGridSize(`repeat(${cols.base}, minmax(3rem, ${size['size-8']}))`)
          } else {
            setGridSize(`repeat(5, minmax(3rem, 1fr))`)
          }
        } else if (md) {
          if (cols.md) {
            setGridSize(`repeat(${cols.md}, minmax(3rem, 1fr))`)
          } else if (cols.base) {
            setGridSize(`repeat(${cols.base}, minmax(3rem,  ${size['size-8']}))`)
          } else {
            setGridSize(`repeat(4, minmax(3rem, 1fr))`)
          }
        } else {
          if (cols.base) {
            setGridSize(`repeat(${cols.base}, minmax(3rem,  ${size['size-8']}))`)
          } else {
            setGridSize(`repeat(2, minmax(3rem, 1fr))`)
          }
        }
      }
    } else {
      if (lg) {
        setGridSize(`repeat(5, minmax(0, 1fr))`)
      } else if (md) {
        setGridSize(`repeat(4, minmax(0, 1fr))`)
      } else {
        setGridSize(`repeat(2, minmax(0, 1fr))`)
      }
    }
  }, [cols, lg, md, children])

  return (
    <div
      className={clsx(grid, { [className]: className })}
      style={assignInlineVars({
        [grid_size]: gridSize,
      })}
      onClick={onClick && onClick}
    >
      {children}
    </div>
  )
}

export default Grid
