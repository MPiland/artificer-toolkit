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
      'borderTop': `1px solid ${foundationVars.color.border.strong}`,
      'borderRight': 0,
      'borderBottom': 0,
      'borderLeft': 0,
      'overflow': 'visible'
    }
  }
})

export const padded = style({
  '@layer': {
    [app]: {
      'padding': `${foundationVars.space[2]} ${foundationVars.space[3]}`,
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
      'maxWidth': 'var(--at-authoring-action-max-width, none)',
      'marginInline': 'auto',
      '@media': {
        [mobile]: {
          gridTemplateColumns: '1fr auto'
        }
      }
    }
  }
})

export const start = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'justifyContent': 'flex-start',
      '@media': {
        [mobile]: {
          gridColumn: '1',
          gridRow: '1'
        }
      }
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
          gridColumn: '1 / -1',
          gridRow: '2',
          justifyContent: 'flex-start'
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
          gridColumn: '2',
          gridRow: '1',
          justifyContent: 'stretch'
        }
      }
    }
  }
})
