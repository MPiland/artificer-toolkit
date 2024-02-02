import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

export const divider = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      margin: '1rem 0',
    },
  },
})

export const divider_line = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexGrow: 1,
      margin: '0 auto',

      selectors: {
        '&:first-of-type': {
          marginRight: '1rem',
        },
        '&:last-of-type': {
          marginLeft: '1rem',
        },
      },
    },
  },
})
