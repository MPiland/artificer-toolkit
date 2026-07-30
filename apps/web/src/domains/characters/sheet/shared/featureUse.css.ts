import { style } from '@vanilla-extract/css'
import { app } from '#css/layers.css'

export const heading = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px 16px',
      justifyContent: 'space-between',
      minWidth: 0
    }
  }
})

export const control = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexShrink: 0,
      gap: '8px'
    }
  }
})
