import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'

export const gmDiceButton = style({
  '@layer': {
    [app]: {
      position: 'fixed',
      insetInlineEnd: foundationVars.space[5],
      insetBlockEnd: foundationVars.space[5],
      zIndex: 20,
      boxShadow: foundationVars.shadow.floatingControl,
      '@media': {
        [compact]: {
          insetInlineEnd: foundationVars.space[3],
          insetBlockEnd: foundationVars.space[3]
        }
      }
    }
  }
})
