import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

export const container = style({
  '@layer': {
    [app]: {
      height: '100%',
      padding: '0 .5rem',
      display: 'flex',
      flexDirection: 'column',
    },
  },
})
