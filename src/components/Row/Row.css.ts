import { app } from '../../css/layers.css'
import { style, styleVariants, createVar } from '@vanilla-extract/css'
import { space } from '../../css/size.css'

export const column_gap = createVar('column_gap')
export const row_gap = createVar('row_gap')

export const rowBase = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      columnGap: column_gap,
      rowGap: row_gap,
      marginBottom: space['space-4'],
    },
  },
})

const rowVariants = {
  full: {
    '@layer': {
      [app]: {
        width: '100%',
      },
    },
  },
  auto: {
    '@layer': {
      [app]: {
        width: 'auto',
      },
    },
  },
}

const spacingVariants = {
  spaceBetween: {
    '@layer': {
      [app]: {
        justifyContent: 'space-between',
      },
    },
  },
  spaceAround: {
    '@layer': {
      [app]: {
        justifyContent: 'space-around',
      },
    },
  },
  flexStart: {
    '@layer': {
      [app]: {
        justifyContent: 'flex-start',
      },
    },
  },
  flexEnd: {
    '@layer': {
      [app]: {
        justifyContent: 'flex-end',
      },
    },
  },
}

export const row = styleVariants({ ...rowVariants, ...spacingVariants }, (variant) => [rowBase, variant])
