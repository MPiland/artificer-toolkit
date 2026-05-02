import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const contentWide = style({
  '@layer': {
    [app]: {
      maxWidth: '1188px'
    }
  }
})

export const singleField = style({
  '@layer': {
    [app]: {
      width: 'min(100%, 240px)'
    }
  },
  '@media': {
    [mobile]: {
      width: '100%'
    }
  }
})
