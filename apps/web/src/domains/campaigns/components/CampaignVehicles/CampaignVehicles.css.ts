import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

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
export const row = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      minBlockSize: '3rem',
      paddingBlock: foundationVars.space[2],
      selectors: {
        '&:not(:last-child)': {
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})
export const picker = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'end',
      gap: foundationVars.space[2],
      flexWrap: 'wrap'
    }
  }
})
export const select = style({ '@layer': { [app]: { flex: '1 1 18rem' } } })
