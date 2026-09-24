import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobileBreakpoint = 'screen and (max-width: 760px)'

export const listStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto auto auto minmax(0, 1fr)',
      height: `calc(100dvh - 56px - ${foundationVars.space[8]} - ${foundationVars.space[8]})`,
      minWidth: 0,
      minHeight: 0,
      gap: foundationVars.space[5],
      '@media': {
        [mobileBreakpoint]: {
          height: '100%'
        }
      }
    }
  }
})

export const contentTabs = style({
  '@layer': {
    [app]: {
      justifySelf: 'start'
    }
  }
})

export const toolbar = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'end',
      gap: foundationVars.space[3],
      minWidth: 0,
      '@media': {
        [mobileBreakpoint]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const filterControls = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(16rem, 320px) repeat(auto-fit, minmax(10rem, 160px))',
      alignItems: 'end',
      gap: foundationVars.space[3],
      minWidth: 0,
      '@media': {
        [mobileBreakpoint]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const viewToggleGroup = style({
  '@layer': {
    [app]: {
      alignSelf: 'end',
      justifySelf: 'end',
      display: 'inline-flex',
      minHeight: '42px',
      padding: '3px',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.input.background.default,
      '@media': {
        [mobileBreakpoint]: {
          justifySelf: 'start',
          minHeight: '52px'
        }
      }
    }
  }
})

export const viewToggleButton = style({
  '@layer': {
    [app]: {
      width: '34px',
      height: '34px',
      border: '1px solid transparent',
      borderRadius: foundationVars.radius.sm,
      backgroundColor: 'transparent',
      color: foundationVars.color.text.secondary,

      ':hover': {
        borderColor: foundationVars.color.border.subtle,
        backgroundColor: foundationVars.color.card.background.hover,
        color: foundationVars.color.text.primary
      },

      ':focus-visible': {
        boxShadow: foundationVars.shadow.focus
      },

      ':disabled': {
        cursor: 'not-allowed',
        opacity: 0.5
      },
      '@media': {
        [mobileBreakpoint]: {
          width: '44px',
          height: '44px'
        }
      }
    }
  }
})

export const viewToggleButtonActive = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.border,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent
    }
  }
})

export const tableShell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr)',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const cardResultsShell = style({
  '@layer': {
    [app]: {
      border: 0,
      borderRadius: 0,
      backgroundColor: 'transparent'
    }
  }
})

export const statePanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'center',
      gap: foundationVars.space[3],
      padding: foundationVars.space[8],
      color: foundationVars.color.text.secondary,
      textAlign: 'center'
    }
  }
})
