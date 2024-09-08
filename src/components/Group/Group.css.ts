import { style, styleVariants } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

export const base = style({
  '@layer': {
    [app]: {
      'position': 'relative',
      'display': 'flex',
      'alignItems': 'center',
      'height': 'fit-content',

      '@media': {
        'screen and (max-width: 567px)': {
          width: 'auto',
        },
      },
    },
  },
})

export const direction = styleVariants({
  row: [
    base,
    {
      '@layer': {
        [app]: {
          flexDirection: 'row',
        },
      },
    },
  ],
  column: [
    base,
    {
      '@layer': {
        [app]: {
          flexDirection: 'column',
        },
      },
    },
  ],
})

export const spacing = styleVariants({
  end: [
    base,
    {
      '@layer': {
        [app]: {
          justifyContent: 'flex-end',
        },
      },
    },
  ],
  start: [
    base,
    {
      '@layer': {
        [app]: {
          justifyContent: 'flex-start',
        },
      },
    },
  ],
  center: [
    base,
    {
      '@layer': {
        [app]: {
          justifyContent: 'center',
        },
      },
    },
  ],
  spaceBetween: [
    base,
    {
      '@layer': {
        [app]: {
          justifyContent: 'space-between',
        },
      },
    },
  ],
  spaceAround: [
    base,
    {
      '@layer': {
        [app]: {
          justifyContent: 'space-around',
        },
      },
    },
  ],
})

export const alignItems = styleVariants({
  start: [
    base,
    {
      '@layer': {
        [app]: {
          alignItems: 'start',
        },
      },
    },
  ],
  end: [
    base,
    {
      '@layer': {
        [app]: {
          alignItems: 'end',
        },
      },
    },
  ],
  center: [
    base,
    {
      '@layer': {
        [app]: {
          alignItems: 'center',
        },
      },
    },
  ],
})

export const flexWrap = styleVariants({
  wrap: [
    base,
    {
      '@layer': {
        [app]: {
          flexWrap: 'wrap',
        },
      },
    },
  ],
  nowrap: [
    base,
    {
      '@layer': {
        [app]: {
          flexWrap: 'nowrap',
        },
      },
    },
  ],
})
