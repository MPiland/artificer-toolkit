import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const layout = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      maxInlineSize: '56rem'
    }
  }
})
export const panel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel
    }
  }
})
export const announcement = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      paddingBlock: foundationVars.space[3],
      selectors: {
        '&:not(:last-child)': {
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})
export const body = style({ '@layer': { [app]: { whiteSpace: 'pre-wrap' } } })
