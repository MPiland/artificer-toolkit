import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const storyCanvas = style({
  '@layer': {
    [app]: {
      minBlockSize: '100dvh',
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary
    }
  }
})

export const canvasSlot = style({
  '@layer': {
    [app]: {
      blockSize: '100dvh',
      minBlockSize: 0,
      minInlineSize: 0
    }
  }
})
