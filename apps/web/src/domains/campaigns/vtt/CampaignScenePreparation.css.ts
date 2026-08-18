import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'

export const panel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      '@media': {
        [compact]: {
          flexDirection: 'column'
        }
      }
    }
  }
})

export const form = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3]
    }
  }
})

export const formGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
      gap: foundationVars.space[3],
      alignItems: 'end'
    }
  }
})

export const preview = style({
  '@layer': {
    [app]: {
      position: 'relative',
      overflow: 'hidden',
      inlineSize: 'min(100%, 48rem)',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.lg,
      background: '#101315',
      selectors: {
        '&::after': {
          position: 'absolute',
          inset: 0,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          content: ''
        }
      }
    }
  }
})

export const previewImage = style({
  '@layer': {
    [app]: {
      display: 'block',
      inlineSize: '100%',
      blockSize: 'auto'
    }
  }
})

export const gridOverlay = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      inset: 0,
      inlineSize: '100%',
      blockSize: '100%',
      pointerEvents: 'none'
    }
  }
})

export const calibrationInstruction = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      insetInline: foundationVars.space[2],
      insetBlockEnd: foundationVars.space[2],
      padding: `${foundationVars.space[1]} ${foundationVars.space[2]}`,
      borderRadius: foundationVars.radius.md,
      background: 'rgba(7, 9, 11, 0.82)',
      color: '#ffffff'
    }
  }
})

export const calibrationMarker = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      inlineSize: '0.85rem',
      blockSize: '0.85rem',
      transform: 'translate(-50%, -50%)',
      border: '2px solid #ffffff',
      borderRadius: foundationVars.radius.pill,
      background: foundationVars.color.accent.focus,
      boxShadow: foundationVars.shadow.focus,
      pointerEvents: 'none'
    }
  }
})

export const sceneList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1]
    }
  }
})

export const sceneRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      inlineSize: '100%',
      minBlockSize: '3rem',
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      border: '1px solid transparent',
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      font: 'inherit',
      textAlign: 'start',
      selectors: {
        '&:hover': {
          borderColor: foundationVars.color.border.strong
        },
        '&:focus-visible': {
          borderColor: foundationVars.color.accent.focus,
          outline: `2px solid ${foundationVars.color.accent.focus}`,
          outlineOffset: '2px'
        },
        '&[data-selected]': {
          borderColor: foundationVars.color.accent.focus,
          background: foundationVars.color.surface.raised
        }
      }
    }
  }
})

export const editor = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.xl,
      background: foundationVars.color.surface.header
    }
  }
})

export const editorHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      padding: foundationVars.space[3],
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

export const editorLayout = style({
  '@layer': {
    [app]: {
      blockSize: 'clamp(34rem, 68vh, 44rem)',
      display: 'grid',
      gridTemplateColumns: '3.25rem minmax(0, 1fr) minmax(16rem, 20rem)',
      '@media': {
        [compact]: {
          blockSize: 'auto',
          gridTemplateColumns: '1fr',
          gridTemplateRows: 'auto minmax(24rem, 62vh) auto'
        }
      }
    }
  }
})

export const inspector = style({
  '@layer': {
    [app]: {
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space[3],
      minBlockSize: 0,
      padding: foundationVars.space[3],
      borderInlineStart: `1px solid ${foundationVars.color.border.subtle}`,
      background: foundationVars.color.surface.panel,
      '@media': {
        [compact]: {
          maxBlockSize: '24rem',
          borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
          borderInlineStart: 0
        }
      }
    }
  }
})

export const objectFields = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: foundationVars.space[3],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md
    }
  }
})

globalStyle(`${objectFields} legend`, {
  '@layer': {
    [app]: {
      paddingInline: foundationVars.space[1],
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})
