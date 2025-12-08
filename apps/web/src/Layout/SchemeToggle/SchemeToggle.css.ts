import { style } from '@vanilla-extract/css'
import { app } from '~css/layers.css'

export const base = style({
  '@layer': {
    [app]: {
      width: '22px',
      height: '22px',
      strokeWidth: '1.5',

      selectors: {
        '&.hide': {
          display: 'none',
        },
      },
    },
  },
})
