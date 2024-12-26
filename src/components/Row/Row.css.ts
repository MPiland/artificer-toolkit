import { app } from '../../css/layers.css'
import { style, styleVariants } from '@vanilla-extract/css'

export const rowBase = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
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
