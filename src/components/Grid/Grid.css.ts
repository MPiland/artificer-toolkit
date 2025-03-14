import { style, createVar, styleVariants } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

// Create separate variables for each breakpoint's flex properties
export const colSpanSm = createVar('flex-sm')
export const colSpanMd = createVar('flex-md')
export const colSpanLg = createVar('flex-lg')

// Create variables for column and row gaps
export const colGap = createVar('column-gap')
export const rowGap = createVar('row-gap')

export const grid = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      columnGap: colGap,
      rowGap: rowGap,
      width: '100%',
    },
  },
})

export const grid_item = style({
  '@layer': {
    [app]: {
      // Base style for small screens
      'flex': colSpanSm,
      'minWidth': 0,
      'height': 'auto',

      // Media queries for responsive behavior
      '@media': {
        '(min-width: 568px)': {
          flex: colSpanMd,
          minWidth: 0,
        },
        '(min-width: 1025px)': {
          flex: colSpanLg,
          minWidth: 0,
        },
      },
    },
  },
})

const grid_item_variant = style({
  '@layer': {
    [app]: {
      display: 'flex',
    },
  },
})

const justify = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  spaceBetween: 'space-between',
  spaceAround: 'space-around',
  spaceEvenly: 'space-evenly',
  stretch: 'stretch',
}

const align = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const flex = {
  row: 'row',
  column: 'column',
}

export const grid_item_justify = styleVariants(justify, (justifyValue) => [
  grid_item_variant,
  { '@layer': { [app]: { justifyContent: justifyValue } } },
])

export const grid_item_align = styleVariants(align, (alignValue) => [
  grid_item_variant,
  { '@layer': { [app]: { alignItems: alignValue } } },
])

export const grid_item_flex = styleVariants(flex, (flexValue: keyof typeof flex) => [
  grid_item_variant,
  { '@layer': { [app]: { flexDirection: flexValue } } },
])
