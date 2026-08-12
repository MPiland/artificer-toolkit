import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const panel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      maxInlineSize: '56rem',
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel
    }
  }
})

export const scheduleGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
      gap: foundationVars.space[3]
    }
  }
})

export const practiceGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      marginBlockStart: foundationVars.space[2]
    }
  }
})
