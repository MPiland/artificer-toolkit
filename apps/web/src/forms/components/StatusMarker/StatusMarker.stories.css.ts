import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

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

export const markerGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      inlineSize: 'min(100%, 18rem)'
    }
  }
})

export const markerRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      padding: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize
    }
  }
})
