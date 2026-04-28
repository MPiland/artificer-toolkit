import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const root = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      justifyItems: 'start',
      width: '100%',
      minHeight: '100%',
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

export const content = style({
  '@layer': {
    [app]: {
      width: '100%',
      maxWidth: '900px',
      minWidth: 0
    }
  }
})

export const storyCanvas = style({
  '@layer': {
    [app]: {
      minHeight: '100dvh',
      padding: `${foundationVars.space[8]} ${foundationVars.space[6]}`,
      backgroundColor: foundationVars.color.surface.canvas
    }
  },
  '@media': {
    [mobile]: {
      padding: foundationVars.space[4]
    }
  }
})
