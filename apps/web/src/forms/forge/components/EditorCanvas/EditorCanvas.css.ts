import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

const tablet = 'screen and (max-width: 900px)'
const mobile = 'screen and (max-width: 640px)'

export const canvas = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      padding: foundationVars.space[5],
      minBlockSize: 0,
      minInlineSize: 0,
      overflowY: 'auto',
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary
    }
  }
})

export const content = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(28rem, 48rem) minmax(17rem, 23rem)',
      alignItems: 'start',
      inlineSize: 'min(100%, 78rem)',
      gap: foundationVars.space[5],
      '@media': {
        [tablet]: {
          gridTemplateColumns: 'minmax(0, 1fr)'
        }
      }
    }
  }
})

export const contentStack = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      minInlineSize: 0,
      rowGap: foundationVars.space[3]
    }
  }
})
