import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const rollValue = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderBottom: '1px dotted transparent',
      borderRadius: foundationVars.radius.sm,
      color: 'inherit',
      cursor: 'pointer',
      display: 'inline',
      font: 'inherit',
      fontWeight: 'inherit',
      lineHeight: 'inherit',
      margin: '-2px -3px',
      padding: '2px 3px',
      textAlign: 'inherit',
      '@media': {
        '(pointer: coarse)': {
          alignItems: 'center',
          display: 'inline-flex',
          minHeight: '44px'
        }
      },
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.recessed,
          borderBottomColor: foundationVars.color.accent.border,
          color: foundationVars.color.text.accent
        },
        '&:active': {
          background: foundationVars.color.surface.recessed
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        },
        '&:disabled': {
          cursor: 'wait',
          opacity: 0.72
        },
        '&[data-rolling]': {
          borderBottomColor: foundationVars.color.accent.border,
          color: foundationVars.color.text.accent,
          opacity: 1
        }
      }
    }
  }
})

export const manualRollButton = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.accent.solid,
      borderRadius: foundationVars.radius.pill,
      color: foundationVars.color.accent.contrast,
      minHeight: '48px',
      minWidth: '48px',
      selectors: {
        '&:hover': {
          background: foundationVars.color.accent.hover
        }
      }
    }
  }
})

export const manualPopover = style({
  '@layer': {
    [app]: {
      boxShadow: foundationVars.shadow.floatingControl,
      display: 'grid',
      gap: '12px',
      maxHeight: 'min(680px, calc(100dvh - 96px))',
      overflowY: 'auto',
      width: 'min(360px, calc(100vw - 24px))'
    }
  }
})

export const manualHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const manualSettings = style({
  '@layer': {
    [app]: {
      borderBlock: `1px solid ${foundationVars.color.border.subtle}`,
      paddingBlock: '8px'
    }
  }
})

export const manualRows = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px'
    }
  }
})

export const manualRow = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: '96px 68px 76px 32px 32px',
      '@media': {
        '(max-width: 420px)': {
          gap: '6px',
          gridTemplateColumns: 'minmax(70px, 1fr) 60px 68px 28px 28px'
        }
      }
    }
  }
})

export const manualActions = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
      justifyContent: 'space-between'
    }
  }
})

export const manualMode = style({
  '@layer': {
    [app]: {
      flex: '0 0 auto'
    }
  }
})

export const manualActionButtons = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '6px',
      marginInlineStart: 'auto'
    }
  }
})

export const historyBody = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      height: '100%',
      minHeight: 0,
      padding: 0
    }
  }
})

export const historyToolbar = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'flex',
      gap: '10px',
      justifyContent: 'flex-end',
      minHeight: '48px',
      padding: '8px 16px'
    }
  }
})

export const historyConfirmActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      gap: '8px',
      marginInlineStart: 'auto'
    }
  }
})

export const historyMessages = style({
  '@layer': {
    [app]: {
      alignContent: 'start',
      background: foundationVars.color.surface.recessed,
      display: 'grid',
      gap: '8px',
      minHeight: 0,
      overflowY: 'auto',
      padding: '12px'
    }
  }
})

export const historyMessage = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px',
      justifyItems: 'start',
      maxWidth: '94%'
    }
  }
})

export const historyAuthor = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.64rem',
      fontWeight: 750,
      lineHeight: 1.15,
      paddingInline: '6px'
    }
  }
})

export const historyBubble = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.raised,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: `4px ${foundationVars.radius.lg} ${foundationVars.radius.lg} ${foundationVars.radius.lg}`,
      boxShadow: foundationVars.shadow.card,
      display: 'grid',
      gap: '1px',
      minWidth: '160px',
      padding: '6px 10px'
    }
  }
})

export const historyTotal = style({
  '@layer': {
    [app]: {
      fontSize: '0.78rem',
      fontWeight: 750,
      lineHeight: 1.2
    }
  }
})

export const historyEvidence = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.7rem',
      lineHeight: 1.2
    }
  }
})

export const historyMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.62rem',
      lineHeight: 1.2
    }
  }
})

export const diceCanvas = style({
  '@layer': {
    [app]: {
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 20
    }
  }
})

globalStyle(`${diceCanvas} canvas`, {
  pointerEvents: 'none'
})

export const staticDiceOverlay = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      inset: 0,
      justifyContent: 'center',
      padding: '24px',
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 20
    }
  }
})

export const staticDiceList = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      justifyContent: 'center',
      maxWidth: 'min(720px, 90%)'
    }
  }
})

export const staticDie = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      background: foundationVars.color.surface.raised,
      border: `2px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.md,
      boxShadow: foundationVars.shadow.card,
      color: foundationVars.color.text.primary,
      display: 'grid',
      height: '58px',
      justifyItems: 'center',
      opacity: 0.46,
      padding: '5px',
      width: '58px',
      selectors: {
        '&[data-kept="true"]': {
          borderColor: foundationVars.color.accent.solid,
          opacity: 1
        }
      }
    }
  }
})

globalStyle(`${staticDie} small`, {
  color: foundationVars.color.text.muted,
  fontSize: '0.62rem',
  lineHeight: 1
})

globalStyle(`${staticDie} strong`, {
  fontSize: '1.35rem',
  lineHeight: 1
})

export const staticRollSummary = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.raised,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.pill,
      boxShadow: foundationVars.shadow.card,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px 10px',
      justifyContent: 'center',
      maxWidth: 'min(680px, 92%)',
      padding: '8px 14px',
      textAlign: 'center'
    }
  }
})

globalStyle(`${staticRollSummary} span`, {
  color: foundationVars.color.text.secondary,
  fontSize: '0.76rem'
})
