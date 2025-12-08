import { style } from '@vanilla-extract/css'
import { app } from '~css/layers.css'

export const base = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      alignItems: 'center',
      paddingLeft: '.75rem',
      paddingRight: '.75rem',
      left: 0,
      bottom: 0,
      width: '100%',
      padding: '.5rem .5rem',
      marginTop: '.5rem',
    },
  },
})
