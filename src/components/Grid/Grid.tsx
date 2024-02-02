import {
  ReactNode,
  FC,
  useLayoutEffect,
  useState,
  Children,
  isValidElement,
} from 'react'
import { grid, grid_size } from './Grid.css'
import clsx from 'clsx'
import { assignInlineVars } from '@vanilla-extract/dynamic'

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
  mediaSize?: string
}

const Grid: FC<GridProps> = ({
  children,
  className,
  cols,
  onClick,
  mediaSize,
}) => {
  const [gridSize, setGridSize] = useState<string>('')

  useLayoutEffect(() => {
    if (cols) {
      if ('start' in cols) {
        let childCount = 0
        const start = `repeat(${cols.start}, minmax(0, 1rem))`
        const end = `repeat(${cols.end}, minmax(0, 1rem)`
        Children.forEach(children, (child) => {
          if (isValidElement(child)) {
            childCount += 1
          }
        })
        childCount -= cols.start
        childCount -= cols.end
        setGridSize(
          clsx(
            {
              [start]: cols.start !== 0,
            },
            `repeat(${childCount}, minmax(0, 1fr))`,
            { [end]: cols.end !== 0 }
          )
        )
      } else {
        // Handle colsSet
        if (mediaSize === 'lg') {
          if (cols && cols.lg) {
            setGridSize(`repeat(${cols.lg}, minmax(0, 1fr))`)
          } else {
            setGridSize(`repeat(6, minmax(0, 1fr))`)
          }
        } else if (mediaSize === 'md') {
          if (cols && cols.md) {
            setGridSize(`repeat(${cols.md}, minmax(0, 1fr))`)
          } else {
            setGridSize(`repeat(4, minmax(0, 1fr))`)
          }
        } else {
          if (cols && cols.base) {
            setGridSize(`repeat(${cols.base}, minmax(0, 1fr))`)
          } else {
            setGridSize(`repeat(2, minmax(0, 1fr))`)
          }
        }
      }
    } else {
      if (mediaSize === 'lg') {
        setGridSize(`repeat(6, minmax(0, 1fr))`)
      } else if (mediaSize === 'md') {
        setGridSize(`repeat(4, minmax(0, 1fr))`)
      } else {
        setGridSize(`repeat(2, minmax(0, 1fr))`)
      }
    }
  }, [cols, mediaSize, children])

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
