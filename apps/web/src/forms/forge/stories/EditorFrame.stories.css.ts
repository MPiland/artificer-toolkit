import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

const tablet = 'screen and (max-width: 900px)'
const mobile = 'screen and (max-width: 640px)'

export const storyCanvas = style({
  '@layer': {
    [app]: {
      minBlockSize: '100dvh',
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary
    }
  }
})

export const frame = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      minBlockSize: '100dvh',
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

export const workspace = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'minBlockSize': 0,
      'overflow': 'hidden',
      '@media': {
        [mobile]: {
          display: 'block'
        }
      }
    }
  }
})

export const railSlot = style({
  '@layer': {
    [app]: {
      'flex': '0 0 clamp(15rem, 23vw, 18rem)',
      'inlineSize': 'clamp(15rem, 23vw, 18rem)',
      'minBlockSize': 0,
      'overflow': 'hidden',
      'transition': 'flex-basis 180ms ease, inline-size 180ms ease',
      '@media': {
        [tablet]: {
          flexBasis: 'clamp(14rem, 30vw, 17.5rem)',
          inlineSize: 'clamp(14rem, 30vw, 17.5rem)'
        },
        [mobile]: {
          display: 'none'
        }
      }
    }
  }
})

export const railSlotClosed = style({
  '@layer': {
    [app]: {
      flexBasis: '0',
      inlineSize: 0
    }
  }
})

export const editorSlot = style({
  '@layer': {
    [app]: {
      flex: '1 1 auto',
      minInlineSize: 0,
      minBlockSize: 0
    }
  }
})
