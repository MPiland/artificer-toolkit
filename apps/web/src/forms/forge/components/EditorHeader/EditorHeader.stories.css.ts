import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const storyCanvas = style({
  '@layer': {
    [app]: {
      minBlockSize: '100dvh',
      padding: foundationVars.space[4],
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary
    }
  }
})

export const surface = style({
  '@layer': {
    [app]: {
      inlineSize: 'min(100%, 52rem)'
    }
  }
})
