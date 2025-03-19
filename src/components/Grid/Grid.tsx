import { Children, Fragment, ReactElement, ReactNode, isValidElement, useEffect, useState } from 'react'
import {
  colGap,
  rowGap,
  grid,
  grid_item,
  colSpanSm,
  colSpanMd,
  colSpanLg,
  grid_item_justify,
  grid_item_align,
  grid_item_flex,
} from './Grid.css'
import { assignInlineVars } from '@vanilla-extract/dynamic'
import clsx from 'clsx'
import { GridContext } from './GridContext'

type ReactSpacing = {
  col?: number
  row?: number
}

type ResponsiveSpan = {
  sm?: number | 'auto' | 'content'
  md?: number | 'auto' | 'content'
  lg?: number | 'auto' | 'content'
}

interface ItemProps {
  children: ReactNode
  colSpan?: number | 'auto' | 'content' | ResponsiveSpan
  className?: string
  ref?: React.Ref<HTMLDivElement>
  id?: string
  justify?: 'start' | 'end' | 'center' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly'
  align?: 'start' | 'end' | 'center' | 'stretch'
  flexDirection?: 'row' | 'column'
}

interface GridProps {
  children: ReactNode
  spacing?: number | ReactSpacing
  className?: string
  id?: string
  ref?: React.Ref<HTMLDivElement>
}

const Grid = ({ children, spacing = 16, className, id, ref }: GridProps) => {
  // State for child count instead of calculation in render
  const [childCount, setChildCount] = useState<number>(0)

  // Effect to update childCount when children change
  useEffect(() => {
    // Recursive function to count actual elements, looking inside fragments
    const countRealChildren = (children: ReactNode): number => {
      let count = 0

      Children.forEach(children, (child) => {
        if (isValidElement(child)) {
          if (child.type === Fragment) {
            // If it's a fragment, count its children
            count += countRealChildren((child as ReactElement<{ children: ReactNode }>).props.children)
          } else {
            // If it's a regular element, count as 1
            count++
          }
        }
      })

      return count
    }

    const count = countRealChildren(children)

    if (count !== childCount) {
      setChildCount(count)
    }
  }, [children, childCount])

  // Calculate column gap
  const colGapValue = typeof spacing === 'number' ? spacing : spacing.col >= 0 ? spacing.col : 16

  // Calculate row gap
  const rowGapValue = typeof spacing === 'number' ? spacing : spacing.row >= 0 ? spacing.row : 16

  return (
    <GridContext value={{ childCount }}>
      <div
        className={clsx(className, grid)}
        style={assignInlineVars({
          [colGap]: `${colGapValue}px`,
          [rowGap]: `${rowGapValue}px`,
        })}
        id={id}
        ref={ref}
      >
        {children}
      </div>
    </GridContext>
  )
}

const Item = ({ children, colSpan = 12, className, ref, id, align, justify, flexDirection = 'row' }: ItemProps) => {
  // Convert column span to flex properties
  const getFlexValue = (
    value: number | 'auto' | 'content' | undefined,
    fallback: number | 'auto' | 'content'
  ): string => {
    // If the value is 'auto', use flex-grow: 1
    if (value === 'auto') {
      return '1 1 0' // flex-grow: 1, flex-shrink: 1, flex-basis: 0
    }

    // If the value is 'content', use flex-basis: auto with no growing
    if (value === 'content') {
      return '0 0 auto' // flex-grow: 0, flex-shrink: 0, flex-basis: auto
    }

    // If value is a number, convert to percentage width (existing logic)
    if (typeof value === 'number') {
      const itemsPerRow = Math.floor(12 / value)
      const percentage = (value / 12) * 100
      if (itemsPerRow > 1) {
        return `0 0 calc(${percentage}% - (${colGap} * ((${itemsPerRow} - 1) / ${itemsPerRow})))`
      }
      return `0 0 ${percentage}%`
    }

    // If value is undefined, check fallback
    if (fallback === 'auto') {
      return '1 1 0'
    }

    if (fallback === 'content') {
      return '0 0 auto'
    }

    // Otherwise, use fallback if it's a number, or default to 100%
    if (typeof fallback === 'number') {
      const itemsPerRow = Math.floor(12 / fallback)
      const percentage = (fallback / 12) * 100
      if (itemsPerRow > 1) {
        return `0 0 calc(${percentage}% - (${colGap} * ((${itemsPerRow} - 1) / ${itemsPerRow})))`
      }
      return `0 0 ${percentage}%`
    }

    return '0 0 100%'
  }

  // Calculate flex values for each breakpoint
  let smValue: string
  let mdValue: string
  let lgValue: string

  if (typeof colSpan === 'object') {
    smValue = getFlexValue(colSpan.sm, 12)
    mdValue = getFlexValue(colSpan.md, colSpan.sm || 12)
    lgValue = getFlexValue(colSpan.lg, colSpan.md || colSpan.sm || 12)
  } else {
    smValue = mdValue = lgValue = getFlexValue(colSpan, 12)
  }

  return (
    <div
      className={clsx(
        className,
        grid_item,
        { [grid_item_justify[justify]]: justify },
        { [grid_item_align[align]]: align },
        { [grid_item_flex[flexDirection]]: align || justify }
      )}
      style={assignInlineVars({
        [colSpanSm]: smValue,
        [colSpanMd]: mdValue,
        [colSpanLg]: lgValue,
      })}
      ref={ref}
      id={id}
    >
      {children}
    </div>
  )
}

Grid.Item = Item

export default Grid
