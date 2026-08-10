import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'

export const overviewStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      inlineSize: '100%',
      maxInlineSize: '56rem'
    }
  }
})

export const compactActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2]
    }
  }
})

export const denominationGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(7rem, 1fr) minmax(5rem, .5fr) minmax(7rem, .6fr) auto',
      gap: foundationVars.space[2],
      alignItems: 'end',
      '@media': { [compact]: { gridTemplateColumns: '1fr 1fr' } }
    }
  }
})
