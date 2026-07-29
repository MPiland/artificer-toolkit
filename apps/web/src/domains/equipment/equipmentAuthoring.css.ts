import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const contentWide = style({
  '@layer': {
    [app]: {
      maxWidth: '1188px'
    }
  }
})

export const fieldGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: foundationVars.space[4],
      '@media': {
        [mobile]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const singleField = style({
  '@layer': {
    [app]: {
      width: 'min(100%, 280px)',
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

export const emptyCopy = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize
    }
  }
})

export const sectionAction = style({
  '@layer': {
    [app]: {
      justifySelf: 'start',
      width: 'fit-content'
    }
  }
})
