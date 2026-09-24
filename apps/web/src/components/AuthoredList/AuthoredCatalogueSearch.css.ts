import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css'
import { app } from '../../css/layers.css'

export const viewport = style({
  '@layer': {
    [app]: {
      minHeight: 0,
      overflow: 'auto',
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[6]
    }
  }
})

export const groupHeader = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[3]
    }
  }
})
