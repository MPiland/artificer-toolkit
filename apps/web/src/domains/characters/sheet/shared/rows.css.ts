import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const playBadge = style({
  '@layer': {
    [app]: {
      justifySelf: 'start',
      maxWidth: '120px'
    }
  }
})

export const featureSummary = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      paddingTop: '12px'
    }
  }
})

export const featureSummaryList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px'
    }
  }
})

export const featureSummaryRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px',
      minWidth: 0
    }
  }
})

export const compactDataList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0,
      minWidth: 0
    }
  }
})

export const compactDataRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.secondary,
      display: 'grid',
      fontSize: '0.8rem',
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(80px, auto)',
      minHeight: '28px',
      minWidth: 0,
      padding: '4px 0',
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const compactDataRowButton = style([
  compactDataRow,
  {
    '@layer': {
      [app]: {
        appearance: 'none',
        background: 'transparent',
        borderLeft: 0,
        borderRight: 0,
        borderTop: 0,
        cursor: 'pointer',
        font: 'inherit',
        textAlign: 'left',
        width: '100%',
        selectors: {
          '&:hover': {
            background: foundationVars.color.surface.recessed
          },
          '&:active': {
            background: foundationVars.color.surface.recessed
          },
          '&:focus-visible': {
            borderRadius: foundationVars.radius.sm,
            boxShadow: foundationVars.shadow.focus,
            outline: 0
          }
        }
      }
    }
  }
])

export const rowList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0
    }
  }
})

export const row = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      padding: '10px 0',
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          gridTemplateColumns: '1fr'
        }
      },
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const compactActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      justifyContent: 'flex-end'
    }
  }
})

export const compactActionControl = style({
  '@layer': {
    [app]: {
      minHeight: '34px',
      '@media': {
        '(max-width: 620px), (pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})

export const resourceStepper = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'grid',
      flexShrink: 0,
      gap: '4px',
      gridTemplateColumns: '30px minmax(44px, auto) 30px',
      minWidth: 0,
      '@media': {
        '(max-width: 620px), (pointer: coarse)': {
          gridTemplateColumns: '44px minmax(44px, auto) 44px'
        }
      }
    }
  }
})

export const resourceStepButton = style({
  '@layer': {
    [app]: {
      height: '30px',
      minHeight: '30px',
      minWidth: '30px',
      padding: 0,
      width: '30px',
      '@media': {
        '(max-width: 620px), (pointer: coarse)': {
          height: '34px',
          minHeight: '34px',
          minWidth: '34px',
          width: '34px'
        }
      },
      selectors: {
        '&:disabled': {
          background: 'transparent',
          borderColor: foundationVars.color.border.subtle,
          color: foundationVars.color.text.muted,
          opacity: 0.45
        }
      }
    }
  }
})

export const resourceStepValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.78rem',
      fontVariantNumeric: 'tabular-nums',
      minWidth: '44px',
      textAlign: 'center'
    }
  }
})

export const commandInlineError = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.danger,
      fontSize: '0.76rem',
      lineHeight: 1.35
    }
  }
})

export const hpControlTarget = style({
  '@layer': {
    [app]: {
      minHeight: '40px',
      '@media': {
        '(max-width: 760px), (pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})
