import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const storyCanvas = style({
  '@layer': {
    [app]: {
      minBlockSize: '100dvh',
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary
    }
  }
})

export const itemStorySurface = style({
  '@layer': {
    [app]: {
      inlineSize: 'clamp(15rem, 23vw, 18rem)',
      minBlockSize: 160,
      paddingBlock: foundationVars.space[2],
      borderInlineEnd: `1px solid ${foundationVars.color.border.strong}`,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const itemStoryInset = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      padding: foundationVars.space[2]
    }
  }
})
