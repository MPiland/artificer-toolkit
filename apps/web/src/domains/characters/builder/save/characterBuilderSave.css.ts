import { style } from '@vanilla-extract/css'
import { app } from '#css/layers.css'

export const modalCloseButton = style({
  '@layer': {
    [app]: {
      minWidth: '44px',
      minHeight: '44px'
    }
  }
})

export const modalActionButton = style({
  '@layer': {
    [app]: {
      minHeight: '44px'
    }
  }
})
