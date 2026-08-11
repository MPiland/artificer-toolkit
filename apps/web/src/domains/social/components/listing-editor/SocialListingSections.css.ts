import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const panel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[4],
      padding: foundationVars.space[5],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel,
      '@media': { [media.mobile]: { padding: foundationVars.space[4] } }
    }
  }
})

export const formGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: foundationVars.space[4],
      '@media': { [media.mobile]: { gridTemplateColumns: '1fr' } }
    }
  }
})

export const spanAll = style({ '@layer': { [app]: { gridColumn: '1 / -1' } } })
