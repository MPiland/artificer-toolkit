import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const root = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'alignItems': 'center',
      'minHeight': '56px',
      'borderTop': `1px solid ${foundationVars.color.border.strong}`
    }
  }
})

export const padded = style({
  '@layer': {
    [app]: {
      'padding': `${foundationVars.space[2]} ${foundationVars.space[13]}`,
      '@media': {
        [mobile]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const flush = style({
  '@layer': {
    [app]: {
      'padding': `${foundationVars.space[2]} 0`,
      '@media': {
        [mobile]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const canvasSurface = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

export const headerSurface = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.surface.header
    }
  }
})

export const inner = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateColumns': '1fr auto 1fr',
      'alignItems': 'center',
      'gap': foundationVars.space[3],
      'width': '100%',
      'maxWidth': '900px',
      'marginInline': 'auto',
      '@media': {
        [mobile]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const start = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-start'
    }
  }
})

export const center = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'justifyContent': 'center',
      'gap': foundationVars.space[2],
      '@media': {
        [mobile]: {
          justifyContent: 'stretch'
        }
      }
    }
  }
})

export const end = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'justifyContent': 'flex-end',
      '@media': {
        [mobile]: {
          justifyContent: 'stretch'
        }
      }
    }
  }
})
