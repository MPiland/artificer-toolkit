import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

export const feature_header = style({
  '@layer': {
    [app]: {
      background: 'lightgrey',
    },
  },
})
