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
      gridRow: '2',
      minBlockSize: 0
    }
  }
})

export const workspace = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridRow: '3',
      gridTemplateColumns: '18rem minmax(28rem, 1fr)',
      gap: foundationVars.space[3],
      minBlockSize: 0,
      minInlineSize: 0,
      '@media': {
        [narrow]: {
          gridTemplateColumns: '17rem minmax(28rem, 1fr)',
          overflow: 'auto'
        }
      }
    }
  }
})

export const controlRail = style({
  '@layer': {
    [app]: {
      minBlockSize: 0,
      minInlineSize: 0,
      selectors: {
        [`${workspace}[data-graph-focused] &`]: {
          display: 'none'
        }
      }
    }
  }
})

export const editorPanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr)',
      minBlockSize: '36rem',
      minInlineSize: 0,
      overflow: 'hidden',
      selectors: {
        [`${workspace}[data-graph-focused] &`]: {
          gridColumn: '1 / -1'
        }
      }
    }
  }
})

export const graph = style({
  '@layer': {
    [app]: {
      position: 'relative',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden'
    }
  }
})
