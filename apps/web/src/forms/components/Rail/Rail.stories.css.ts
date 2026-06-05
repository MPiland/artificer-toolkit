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

export const railSurface = style({
  '@layer': {
    [app]: {
      inlineSize: 'clamp(15rem, 23vw, 18rem)',
      blockSize: '100dvh',
      minBlockSize: 0
    }
  }
})
