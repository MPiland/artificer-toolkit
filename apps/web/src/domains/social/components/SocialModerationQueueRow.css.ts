import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const row = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: foundationVars.space[4],
      padding: foundationVars.space[5],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel,
      '@media': { [media.mobile]: { gridTemplateColumns: '1fr', padding: foundationVars.space[4] } }
    }
  }
})

export const rowBody = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[2],
      minInlineSize: 0
    }
  }
})

export const rowActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2],
      '@media': { [media.mobile]: { justifyContent: 'flex-start' } }
    }
  }
})
