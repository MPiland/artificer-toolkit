import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const base = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`,
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      fontSize: foundationVars.typography.caption.fontSize
    }
  }
})
