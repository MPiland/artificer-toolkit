import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'
const overlayRail =
  'screen and (max-width: 640px), screen and (max-width: 900px) and (orientation: portrait)'

export const root = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignItems: 'center',
      minHeight: '56px',
      borderTop: `1px solid ${foundationVars.color.border.strong}`,
      borderRight: 0,
      borderBottom: 0,
      borderLeft: 0,
      overflow: 'visible'
    }
  }
})

export const padded = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      '@media': {
        [overlayRail]: {
          minHeight: 56
        },
        [mobile]: {
          padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`
        }
      }
    }
  }
})

export const flush = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[2]} 0`,
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
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: foundationVars.space[3],
      width: '100%',
      maxWidth: 'var(--at-authoring-action-max-width, none)',
      marginInline: 'auto',
      '@media': {
        [overlayRail]: {
          gridTemplateColumns: '1fr 1fr',
          maxWidth: 'none'
        },
        [mobile]: {
          gridTemplateColumns: '1fr 1fr'
        }
      }
    }
  }
})

export const start = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-start',
      '@media': {
        [overlayRail]: {
          gridColumn: '1',
          gridRow: '1'
        },
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
      display: 'flex',
      justifyContent: 'center',
      gap: foundationVars.space[2],
      '@media': {
        [overlayRail]: {
          display: 'none'
        },
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
      display: 'flex',
      justifyContent: 'flex-end',
      '@media': {
        [overlayRail]: {
          gridColumn: '2',
          gridRow: '1'
        },
        [mobile]: {
          gridColumn: '2',
          gridRow: '1',
          justifyContent: 'stretch'
        }
      }
    }
  }
})
