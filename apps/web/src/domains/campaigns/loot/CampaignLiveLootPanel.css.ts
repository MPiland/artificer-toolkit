import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const range = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      padding: foundationVars.space[2],
      border: '1px solid transparent',
      borderRadius: foundationVars.radius.lg,
      selectors: {
        '&[data-matched]': {
          borderColor: foundationVars.color.accent.border,
          background: foundationVars.color.accent.soft
        }
      }
    }
  }
})
