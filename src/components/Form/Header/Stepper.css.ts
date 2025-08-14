import { app } from '~/css/layers.css'
import { style } from '@vanilla-extract/css'

export const label = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      top: '25%',
      left: '25%',
    },
  },
})
