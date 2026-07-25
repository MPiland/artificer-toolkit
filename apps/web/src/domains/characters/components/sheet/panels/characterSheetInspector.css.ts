import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const drawerContent = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.canvas,
      borderLeft: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const drawerHeader = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      minHeight: '64px',
      paddingInline: '20px'
    }
  }
})

export const drawerTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.05rem',
      fontWeight: 760
    }
  }
})

export const drawerBody = style({
  '@layer': {
    [app]: {
      padding: 0
    }
  }
})

export const inspector = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      display: 'grid',
      minHeight: '100%'
    }
  }
})

export const section = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '12px',
      padding: '20px',
      selectors: {
        '&:first-child': {
          borderTop: 0
        }
      }
    }
  }
})

export const summary = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr) auto'
    }
  }
})

export const summaryValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '2rem',
      fontWeight: 780,
      letterSpacing: '-0.025em',
      lineHeight: 1
    }
  }
})

export const summaryLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.78rem',
      fontWeight: 700
    }
  }
})

export const stateBadge = style({
  '@layer': {
    [app]: {
      letterSpacing: 0,
      textTransform: 'none'
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.9rem',
      fontWeight: 760,
      lineHeight: 1.2,
      margin: 0
    }
  }
})

export const muted = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.78rem',
      lineHeight: 1.45
    }
  }
})

export const calculationList = style({
  '@layer': {
    [app]: {
      display: 'grid'
    }
  }
})

export const calculationRow = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      paddingBlock: '9px',
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const suppressed = style({
  '@layer': {
    [app]: {
      opacity: 0.62,
      textDecoration: 'line-through'
    }
  }
})

export const editor = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      paddingBlock: '14px',
      selectors: {
        '&:last-child': {
          borderBottom: 0,
          paddingBottom: 0
        },
        '&:first-child': {
          paddingTop: 0
        }
      }
    }
  }
})

export const editorPrimary = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr) auto'
    }
  }
})

export const editorMetadata = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 0.7fr) minmax(0, 1.3fr)',
      '@media': {
        '(max-width: 520px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const entries = style({
  '@layer': {
    [app]: {
      display: 'grid'
    }
  }
})

export const entry = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      minHeight: '48px',
      paddingBlock: '8px',
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const entryButton = style({
  '@layer': {
    [app]: {
      'alignItems': 'center',
      'background': 'transparent',
      'border': 0,
      'borderBottom': `1px solid ${foundationVars.color.border.subtle}`,
      'color': 'inherit',
      'cursor': 'pointer',
      'display': 'grid',
      'font': 'inherit',
      'gap': '12px',
      'gridTemplateColumns': 'minmax(0, 1fr) auto',
      'minHeight': '48px',
      'padding': '8px 4px',
      'textAlign': 'left',
      'width': '100%',
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.subtle
        },
        '&:focus-visible': {
          boxShadow: `inset 0 0 0 2px ${foundationVars.color.accent.focus}`,
          outline: 0
        },
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const actions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      justifyContent: 'flex-end'
    }
  }
})

export const loading = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '14px',
      padding: '20px'
    }
  }
})
