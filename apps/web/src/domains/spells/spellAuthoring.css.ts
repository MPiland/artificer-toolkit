import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const fieldGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: foundationVars.space[4],
      '@media': {
        [mobile]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const inputRow = style({
  '@layer': {
    [app]: {
      width: 'min(100%, 276px)',
      '@media': {
        [mobile]: {
          width: '100%'
        }
      }
    }
  }
})

export const wide = style({
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
    }
  }
})
