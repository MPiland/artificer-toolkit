import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const footer = style({
  '@layer': {
    [app]: {
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})
