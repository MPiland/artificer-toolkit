import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'
export const control = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[2],
      minBlockSize: '2.75rem'
    }
  }
})
export const summary = style({
  '@layer': { [app]: { display: 'grid', gap: 2, whiteSpace: 'nowrap' } }
})
export const popover = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      inlineSize: 'min(24rem, calc(100vw - 2.5rem))'
    }
  }
})
export const grid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: foundationVars.space[3],
      '@media': { [compact]: { gridTemplateColumns: '1fr' } }
    }
  }
})
