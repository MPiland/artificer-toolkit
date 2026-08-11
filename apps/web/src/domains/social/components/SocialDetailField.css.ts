import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const prose = style({
  '@layer': {
    [app]: {
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      color: foundationVars.color.text.secondary
    }
  }
})
