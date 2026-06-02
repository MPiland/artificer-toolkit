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

export const railCollapse = style({
  '@layer': {
    [app]: {
      'flex': '0 0 clamp(15rem, 23vw, 18rem)',
      'inlineSize': 'clamp(15rem, 23vw, 18rem)',
      'minBlockSize': 0,
      'overflow': 'hidden',
      'transition': `inline-size ${foundationVars.motion.base} cubic-bezier(0.2, 0, 0, 1), flex-basis ${foundationVars.motion.base} cubic-bezier(0.2, 0, 0, 1)`,
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

export const railCollapseClosed = style({
  '@layer': {
    [app]: {
      flexBasis: '0 !important',
      inlineSize: '0 !important'
    }
  }
})

export const railSlot = style({
  '@layer': {
    [app]: {
      inlineSize: 'clamp(15rem, 23vw, 18rem)',
      blockSize: '100%',
      'minBlockSize': 0,
      '@media': {
        [tablet]: {
          inlineSize: 'clamp(14rem, 30vw, 17.5rem)'
        },
        [mobile]: {
          display: 'none'
        }
      }
    }
  }
})

export const editorPlaceholder = style({
  '@layer': {
    [app]: {
      flex: '1 1 auto',
      minBlockSize: 0,
      minInlineSize: 0,
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

export const inspectorPlaceholder = style({
  '@layer': {
    [app]: {
      'flex': '0 0 clamp(15rem, 24vw, 19rem)',
      'minBlockSize': 0,
      'borderInlineStart': `1px solid ${foundationVars.color.border.subtle}`,
      'backgroundColor': foundationVars.color.surface.panel,
      '@media': {
        [tablet]: {
          display: 'none'
        }
      }
    }
  }
})
