import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

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

export const customizationList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3]
    }
  }
})

export const customizationRow = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: foundationVars.space[3],
      paddingBottom: foundationVars.space[4],
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const customizationHeading = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: foundationVars.space[2],
      justifyContent: 'space-between'
    }
  }
})

export const customizationFields = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: foundationVars.space[3],
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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
      alignItems: 'center',
      background: 'transparent',
      border: 0,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: 'inherit',
      cursor: 'pointer',
      display: 'grid',
      font: 'inherit',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      minHeight: '48px',
      padding: '8px 4px',
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

export const badges = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
      justifyContent: 'flex-end'
    }
  }
})

export const slotRow = style({
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

export const slotPips = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
      justifyContent: 'flex-end'
    }
  }
})

export const slotPip = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: 'transparent',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: '3px',
      cursor: 'pointer',
      height: '24px',
      padding: 0,
      width: '24px',
      selectors: {
        '&:hover': {
          borderColor: foundationVars.color.accent.solid
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        },
        '&:disabled': {
          cursor: 'default',
          opacity: 0.5
        }
      }
    }
  }
})

export const slotPipUsed = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.accent.solid,
      borderColor: foundationVars.color.accent.solid,
      outline: `3px solid ${foundationVars.color.surface.panel}`,
      outlineOffset: '-4px'
    }
  }
})

export const builderHandoff = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      '@media': {
        '(max-width: 440px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const entryLink = style({
  '@layer': {
    [app]: {
      background: 'transparent',
      border: 0,
      color: 'inherit',
      cursor: 'pointer',
      font: 'inherit',
      padding: 0,
      textAlign: 'left',
      selectors: {
        '&:focus-visible': {
          borderRadius: '4px',
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        }
      }
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
