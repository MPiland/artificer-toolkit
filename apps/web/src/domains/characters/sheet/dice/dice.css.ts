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
      boxSizing: 'border-box',
      boxShadow: foundationVars.shadow.floatingControl,
      display: 'grid',
      gap: '12px',
      maxHeight: 'min(680px, calc(100dvh - 96px))',
      maxInlineSize: 'calc(100vw - 16px)',
      overflowY: 'auto',
      width: 'min(360px, calc(100vw - 16px))'
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

export const manualDestination = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '8px',
      justifyContent: 'space-between',
      '@media': {
        '(max-width: 420px)': {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
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
          gridTemplateColumns: 'minmax(0, 1fr) 68px 72px 32px 32px'
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
      justifyContent: 'space-between',
      '@media': {
        '(max-width: 420px)': {
          alignItems: 'stretch',
          display: 'grid',
          inlineSize: '100%'
        }
      }
    }
  }
})

export const manualMode = style({
  '@layer': {
    [app]: {
      flex: '0 0 auto',
      '@media': {
        '(max-width: 420px)': {
          inlineSize: '100%'
        }
      }
    }
  }
})

export const manualActionButtons = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '6px',
      marginInlineStart: 'auto',
      '@media': {
        '(max-width: 420px)': {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          inlineSize: '100%',
          marginInlineStart: 0
        }
      }
    }
  }
})

globalStyle(`${manualRow} > *`, {
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

globalStyle(`${manualActionButtons} > *`, {
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 420px)': {
          inlineSize: '100%'
        }
      }
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

export const afterRollOffers = style({
  '@layer': {
    [app]: {
      bottom: foundationVars.space[6],
      left: '50%',
      pointerEvents: 'auto',
      position: 'fixed',
      transform: 'translateX(-50%)',
      zIndex: 30
    }
  }
})
