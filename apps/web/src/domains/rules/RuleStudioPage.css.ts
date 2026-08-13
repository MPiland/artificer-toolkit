import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css'
import { app } from '../../css/layers.css'

const narrow = 'screen and (max-width: 1100px)'

export const root = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      display: 'grid',
      gridTemplateRows: 'auto auto minmax(0, 1fr)',
      gap: foundationVars.space[4],
      blockSize: '100%',
      minBlockSize: 0,
      padding: foundationVars.space[4],
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      '@media': {
        [narrow]: {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
    }
  }
})

export const pageAlert = style({
  '@layer': {
    [app]: {
      minBlockSize: 0
    }
  }
})

export const workspace = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '16rem minmax(28rem, 1fr) 22rem',
      gap: foundationVars.space[3],
      minBlockSize: 0,
      minInlineSize: 0,
      '@media': {
        [narrow]: {
          gridTemplateColumns: '14rem minmax(28rem, 1fr)',
          overflow: 'auto'
        }
      }
    }
  }
})

export const sidebar = style({
  '@layer': {
    [app]: {
      minBlockSize: 0,
      overflow: 'auto'
    }
  }
})

export const editorPanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      minBlockSize: '36rem',
      minInlineSize: 0,
      overflow: 'hidden'
    }
  }
})

export const editorToolbar = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[3],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const graph = style({
  '@layer': {
    [app]: {
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden'
    }
  }
})

export const fixturePanel = style({
  '@layer': {
    [app]: {
      minBlockSize: 0,
      overflow: 'auto',
      '@media': {
        [narrow]: {
          gridColumn: '1 / -1'
        }
      }
    }
  }
})
