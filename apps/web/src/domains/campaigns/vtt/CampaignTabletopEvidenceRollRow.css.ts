import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

/** Positions the shared dice overlay beneath the row that rolled it. */
export const diceStage = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      height: '11rem',
      overflow: 'hidden',
      position: 'relative'
    }
  }
})
