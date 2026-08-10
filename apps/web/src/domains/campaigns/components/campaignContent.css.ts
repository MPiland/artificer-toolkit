import { style } from '@vanilla-extract/css'
import { app } from '#app/css/layers.css'

export const inputRowButton = style({
  '@layer': {
    [app]: {
      minBlockSize: '40px'
    }
  }
})
