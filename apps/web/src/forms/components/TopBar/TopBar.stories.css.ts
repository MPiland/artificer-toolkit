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

export const workspaceHint = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateColumns': 'minmax(13rem, 22%) minmax(0, 1fr) minmax(15rem, 24%)',
      'minBlockSize': 0,
      '@media': {
        [tablet]: {
          gridTemplateColumns: 'minmax(12rem, 28%) minmax(0, 1fr)'
        },
        [mobile]: {
          gridTemplateColumns: 'minmax(0, 1fr)'
        }
      }
    }
  }
})

export const railHint = style({
  '@layer': {
    [app]: {
      'minBlockSize': 0,
      'borderInlineEnd': `1px solid ${foundationVars.color.border.strong}`,
      'backgroundColor': foundationVars.color.surface.sidebar,
      '@media': {
        [mobile]: {
          display: 'none'
        }
      }
    }
  }
})

export const editorHint = style({
  '@layer': {
    [app]: {
      minBlockSize: 0,
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

export const inspectorHint = style({
  '@layer': {
    [app]: {
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
