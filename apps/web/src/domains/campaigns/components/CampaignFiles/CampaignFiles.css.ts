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
export const formGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
      gap: foundationVars.space[3],
      alignItems: 'end'
    }
  }
})
export const row = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: foundationVars.space[3],
      minBlockSize: '3.5rem',
      paddingBlock: foundationVars.space[2],
      selectors: {
        '&:not(:last-child)': {
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})
