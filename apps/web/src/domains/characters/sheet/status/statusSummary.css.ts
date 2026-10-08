import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const statusStripPanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      minWidth: 0,
      position: 'relative'
    }
  }
})

export const mobileStatusBar = style({
  '@layer': {
    [app]: {
      alignItems: 'stretch',
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gridColumn: '1 / -1',
      gridTemplateColumns: 'minmax(86px, 0.8fr) minmax(0, 1.4fr) minmax(82px, auto)',
      minWidth: 0,
      padding: '0 10px'
    }
  }
})

export const mobileStatusItem = style({
  '@layer': {
    [app]: {
      alignContent: 'center',
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '2px',
      minHeight: '44px',
      minWidth: 0,
      padding: '5px 8px',
      selectors: {
        '&:last-child': {
          borderInlineEnd: 0
        }
      }
    }
  }
})

export const mobileStatusAction = style([
  mobileStatusItem,
  {
    '@layer': {
      [app]: {
        appearance: 'none',
        background: 'transparent',
        borderBlock: 0,
        borderInlineStart: 0,
        color: 'inherit',
        cursor: 'pointer',
        font: 'inherit',
        textAlign: 'left',
        width: '100%',
        selectors: {
          '&:hover': {
            background: foundationVars.color.surface.subtle
          },
          '&:focus-visible': {
            boxShadow: foundationVars.shadow.focus,
            outline: 0
          },
          '&:disabled': {
            cursor: 'default',
            opacity: 0.55
          }
        }
      }
    }
  }
])

export const mobileStatusValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.72rem',
      fontWeight: 750,
      lineHeight: 1.1,
      minWidth: 0
    }
  }
})

export const mobileInspirationButton = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.secondary,
      cursor: 'pointer',
      display: 'flex',
      font: 'inherit',
      fontSize: '0.7rem',
      fontWeight: 750,
      gap: '4px',
      minHeight: '44px',
      minWidth: 0,
      padding: 0,
      width: '100%',
      selectors: {
        '&[data-active="true"]': {
          color: foundationVars.color.text.accent
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        },
        '&:disabled': {
          cursor: 'not-allowed',
          opacity: 0.55
        }
      }
    }
  }
})

export const statusStrip = style({
  '@layer': {
    [app]: {
      alignItems: 'stretch',
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: 0,
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      minWidth: 0,
      overflow: 'hidden',
      '@media': {
        '(min-width: 960px) and (max-width: 1199px) and (orientation: landscape)': {
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
        },
        '(max-width: 620px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        }
      }
    }
  }
})

export const conditionsOnlyStrip = style({
  '@layer': {
    [app]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
    }
  }
})

export const statusStripItem = style({
  '@layer': {
    [app]: {
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'flex',
      flexDirection: 'column',
      minHeight: '80px',
      minWidth: 0,
      padding: '8px 10px',
      selectors: {
        '&:last-child': {
          borderInlineEnd: 0
        }
      }
    }
  }
})

export const statusStripLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.68rem',
      fontWeight: 750,
      lineHeight: 1.2,
      minHeight: '16px',
      textAlign: 'center',
      width: '100%'
    }
  }
})

export const statusStripContent = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      minHeight: 0,
      width: '100%'
    }
  }
})

export const statusStripContentStart = style({
  '@layer': {
    [app]: {
      justifyContent: 'flex-start'
    }
  }
})

export const statusStripContentCenter = style({
  '@layer': {
    [app]: {
      justifyContent: 'center',
      textAlign: 'center'
    }
  }
})

export const statusStripStack = style({
  '@layer': {
    [app]: {
      alignItems: 'flex-start',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      minWidth: 0
    }
  }
})

export const statusStripCenteredStack = style({
  '@layer': {
    [app]: {
      alignItems: 'center'
    }
  }
})

export const statusStripValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.84rem',
      fontWeight: 750,
      lineHeight: 1.1
    }
  }
})

export const statusValueButton = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      font: 'inherit',
      fontSize: '0.84rem',
      fontWeight: 750,
      lineHeight: 1.1,
      padding: '5px 7px',
      selectors: {
        '&:hover, &:active': {
          background: foundationVars.color.surface.recessed
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        },
        '&:disabled': {
          cursor: 'not-allowed',
          opacity: 0.55
        }
      }
    }
  }
})

export const inspirationPip = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      background: 'transparent',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.pill,
      color: foundationVars.color.text.muted,
      cursor: 'pointer',
      display: 'inline-flex',
      height: '24px',
      justifyContent: 'center',
      padding: 0,
      selectors: {
        '&[data-active="true"]': {
          background: foundationVars.color.accent.soft,
          borderColor: foundationVars.color.accent.border,
          color: foundationVars.color.accent.solid
        },
        '&:disabled': {
          cursor: 'not-allowed',
          opacity: 0.55
        }
      },
      width: '24px'
    }
  }
})

export const conditionSummary = style([
  statusStripItem,
  {
    '@layer': {
      [app]: {
        borderInlineEnd: 0
      }
    }
  }
])

export const conditionAddShell = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      appearance: 'none',
      background: 'transparent',
      border: `1px dashed ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.secondary,
      cursor: 'pointer',
      display: 'grid',
      font: 'inherit',
      gap: '8px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      minHeight: '34px',
      minWidth: 0,
      padding: '6px 9px',
      textAlign: 'left',
      width: '100%',
      selectors: {
        '&:hover, &:active': {
          background: foundationVars.color.surface.recessed
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        },
        '&:disabled': {
          cursor: 'not-allowed',
          opacity: 0.55
        }
      },
      '@media': {
        '(min-width: 960px) and (max-width: 1199px) and (orientation: landscape)': {
          minHeight: '30px',
          padding: '4px 7px'
        }
      }
    }
  }
})

export const conditionAddText = style({
  '@layer': {
    [app]: {
      fontSize: '0.84rem',
      lineHeight: 1.1
    }
  }
})
