import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'

export const visuallyHidden = style({
  blockSize: 1,
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  inlineSize: 1,
  overflow: 'hidden',
  position: 'absolute',
  whiteSpace: 'nowrap'
})

export const menuLabel = style({
  color: foundationVars.color.text.primary,
  fontWeight: 600
})

export const menuDropdown = style({
  boxShadow: foundationVars.shadow.card,
  maxBlockSize: 'calc(100dvh - 2rem)',
  overscrollBehavior: 'contain',
  overflowY: 'auto'
})

export const shell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto auto minmax(0, 1fr)',
      overflow: 'hidden',
      blockSize: '100%',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.xl,
      background: foundationVars.color.surface.header,
      boxShadow: foundationVars.shadow.card
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      minBlockSize: '3.5rem',
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      background: foundationVars.color.surface.panel,
      '@media': {
        [compact]: {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
    }
  }
})

export const identity = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      minInlineSize: 0
    }
  }
})

export const status = style({
  '@layer': {
    [app]: {
      inlineSize: '0.55rem',
      blockSize: '0.55rem',
      flex: '0 0 auto',
      borderRadius: foundationVars.radius.pill,
      background: foundationVars.color.status.warning,
      selectors: {
        '&[data-connected]': {
          background: foundationVars.color.status.success
        }
      }
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.semibold,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const headerActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2],
      flexWrap: 'wrap',
      '@media': {
        [compact]: {
          justifyContent: 'space-between'
        }
      }
    }
  }
})

export const stageLayout = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '3.25rem minmax(0, 1fr)',
      blockSize: '100%',
      minBlockSize: 'min(68vh, 44rem)',
      '@media': {
        [compact]: {
          gridTemplateColumns: '1fr',
          gridTemplateRows: 'auto minmax(24rem, 62vh)'
        }
      }
    }
  }
})

export const toolbar = style({
  '@layer': {
    [app]: {
      zIndex: 2,
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'column',
      gap: foundationVars.space[1],
      padding: foundationVars.space[2],
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      background: foundationVars.color.surface.panel,
      '@media': {
        [compact]: {
          overflowX: 'auto',
          flexDirection: 'row',
          borderInlineEnd: 0,
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const canvasFrame = style({
  '@layer': {
    [app]: {
      position: 'relative',
      overflow: 'hidden',
      minInlineSize: 0,
      minBlockSize: '34rem',
      background: '#101315',
      touchAction: 'none',
      '@media': {
        [compact]: {
          minBlockSize: '24rem'
        }
      }
    }
  }
})

globalStyle(`${canvasFrame} canvas`, {
  '@layer': {
    [app]: {
      display: 'block',
      inlineSize: '100%',
      blockSize: '100%'
    }
  }
})

export const overlay = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      insetBlockStart: foundationVars.space[3],
      insetInlineEnd: foundationVars.space[3],
      zIndex: 2,
      display: 'flex',
      gap: foundationVars.space[2],
      pointerEvents: 'none'
    }
  }
})

export const overlayPill = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[1]} ${foundationVars.space[2]}`,
      border: '1px solid rgba(255, 255, 255, 0.18)',
      borderRadius: foundationVars.radius.pill,
      background: 'rgba(7, 9, 11, 0.76)',
      color: '#ffffff',
      fontSize: '0.75rem',
      fontWeight: foundationVars.fontWeight.semibold,
      backdropFilter: 'blur(8px)'
    }
  }
})

export const canvasInstruction = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      insetInlineStart: foundationVars.space[3],
      insetBlockEnd: foundationVars.space[3],
      zIndex: 2,
      maxInlineSize: 'min(32rem, calc(100% - 2rem))',
      padding: `${foundationVars.space[1]} ${foundationVars.space[2]}`,
      borderRadius: foundationVars.radius.md,
      background: 'rgba(7, 9, 11, 0.82)',
      color: '#ffffff'
    }
  }
})

export const empty = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      justifyItems: 'start',
      padding: foundationVars.space[5],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      background: foundationVars.color.surface.panel
    }
  }
})

export const attachControls = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(14rem, 24rem) auto',
      gap: foundationVars.space[2],
      alignItems: 'end',
      inlineSize: '100%',
      '@media': {
        [compact]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const error = style({
  '@layer': {
    [app]: {
      margin: foundationVars.space[3]
    }
  }
})
