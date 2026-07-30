import { style } from '@vanilla-extract/css'
import { foundationVars } from '../css/foundations.css'
import { app } from '../css/layers.css'

const compact = 'screen and (max-width: 64rem)'

export const layout = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(16rem, 20rem) minmax(0, 1fr)',
      minBlockSize: 'calc(100dvh - 8rem)',
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.canvas,
      '@media': {
        [compact]: {
          display: 'block',
          minBlockSize: 'auto',
          overflow: 'visible'
        }
      }
    }
  }
})

export const rail = style({
  '@layer': {
    [app]: {
      alignSelf: 'stretch',
      minBlockSize: 'calc(100dvh - 8rem)',
      padding: `${foundationVars.space[6]} ${foundationVars.space[4]}`,
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.recessed,
      '@media': {
        [compact]: {
          position: 'static',
          minBlockSize: 'auto',
          padding: foundationVars.space[5],
          borderInlineEnd: 0,
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const railHeader = style({
  '@layer': {
    [app]: {
      paddingBlockEnd: foundationVars.space[4],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      '@media': {
        [compact]: {
          display: 'none'
        }
      }
    }
  }
})

export const mobileHeaderToggle = style({
  '@layer': {
    [app]: {
      width: '100%',
      minBlockSize: '44px',
      marginBottom: foundationVars.space[4],
      display: 'none',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: foundationVars.space[3],
      borderRadius: foundationVars.radius.sm,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`,
      color: foundationVars.color.text.primary,
      backgroundColor: foundationVars.color.surface.panel,
      cursor: 'pointer',
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease`,
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      },
      ':hover': {
        backgroundColor: foundationVars.color.surface.subtle
      },
      '@media': {
        [compact]: {
          display: 'flex'
        }
      }
    }
  }
})

export const drawerRailHeader = style({
  '@layer': {
    [app]: {
      marginBottom: foundationVars.space[5],
      paddingBlockEnd: foundationVars.space[5],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const settingsDrawerContent = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.primary
    }
  }
})

export const settingsDrawerHeader = style({
  '@layer': {
    [app]: {
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.primary
    }
  }
})

export const settingsDrawerBody = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[4]
    }
  }
})

export const settingsMobileTitle = style({
  '@layer': {
    [app]: {
      flex: 1,
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '1rem',
      fontWeight: foundationVars.fontWeight.semibold,
      textAlign: 'left'
    }
  }
})

export const settingsTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.display,
      fontSize: '1.75rem',
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '-0.025em',
      lineHeight: 1.05
    }
  }
})

export const settingsDescription = style({
  '@layer': {
    [app]: {
      maxInlineSize: '24ch',
      margin: `${foundationVars.space[2]} 0 0`,
      color: foundationVars.color.text.secondary,
      lineHeight: 1.5
    }
  }
})

export const accountEmail = style({
  '@layer': {
    [app]: {
      margin: `${foundationVars.space[4]} 0 0`,
      overflow: 'hidden',
      color: foundationVars.color.text.muted,
      fontSize: '0.875rem',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const navigation = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      paddingBlockStart: foundationVars.space[4],
      '@media': {
        [compact]: {
          display: 'none'
        }
      }
    }
  }
})

export const navigationHeader = style({
  '@layer': {
    [app]: {
      display: 'grid'
    }
  }
})

export const navigationDrawer = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      paddingBlockStart: foundationVars.space[5],
      '@media': {
        [compact]: {
          display: 'grid'
        }
      }
    }
  }
})

export const navigationLink = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[3],
      minBlockSize: 44,
      paddingInline: foundationVars.space[3],
      border: '1px solid transparent',
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.secondary,
      textDecoration: 'none',
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,
      ':hover': {
        backgroundColor: foundationVars.color.surface.subtle,
        color: foundationVars.color.text.primary
      },
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const navigationLinkActive = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.border,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent
    }
  }
})

export const contentPane = style({
  '@layer': {
    [app]: {
      minInlineSize: 0,
      padding: `${foundationVars.space[6]} clamp(${foundationVars.space[5]}, 4vw, ${foundationVars.space[8]})`,
      '@media': {
        [compact]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const pageHeader = style({
  '@layer': {
    [app]: {
      maxInlineSize: '70ch',
      paddingBlockEnd: foundationVars.space[4],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const pageTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.display,
      fontSize: '1.5rem',
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '-0.02em',
      lineHeight: 1.1
    }
  }
})

export const pageDescription = style({
  '@layer': {
    [app]: {
      margin: `${foundationVars.space[2]} 0 0`,
      color: foundationVars.color.text.secondary,
      lineHeight: 1.5
    }
  }
})

export const form = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      maxInlineSize: '44rem',
      paddingBlockStart: foundationVars.space[5]
    }
  }
})

export const formActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      gap: foundationVars.space[2]
    }
  }
})

export const settingRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(12rem, 1fr) minmax(18rem, 1.2fr)',
      gap: foundationVars.space[5],
      alignItems: 'center',
      paddingBlock: foundationVars.space[5],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      '@media': {
        [compact]: {
          gridTemplateColumns: '1fr',
          gap: foundationVars.space[4]
        }
      }
    }
  }
})

export const settingCopy = style({
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

export const settingTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '1rem',
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

export const settingDescription = style({
  '@layer': {
    [app]: {
      maxInlineSize: '65ch',
      margin: `${foundationVars.space[1]} 0 0`,
      color: foundationVars.color.text.secondary,
      fontSize: '0.875rem',
      lineHeight: 1.6
    }
  }
})

export const appearanceControl = style({
  '@layer': {
    [app]: {
      inlineSize: '100%'
    }
  }
})

export const accountSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      paddingBlock: foundationVars.space[5],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const accountSectionSummary = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      '@media': {
        [compact]: {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
    }
  }
})

export const accountActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2]
    }
  }
})

export const accountForm = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      maxInlineSize: '44rem'
    }
  }
})

export const credentialValue = style({
  '@layer': {
    [app]: {
      margin: `${foundationVars.space[1]} 0 0`,
      color: foundationVars.color.text.secondary,
      fontFamily: foundationVars.font.mono,
      fontSize: '1rem',
      letterSpacing: '0.08em'
    }
  }
})

export const loadingState = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minBlockSize: '16rem',
      placeItems: 'center'
    }
  }
})

export const errorState = style({
  '@layer': {
    [app]: {
      maxInlineSize: '40rem',
      padding: foundationVars.space[5],
      border: `1px solid ${foundationVars.color.status.danger}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.status.dangerSoft,
      color: foundationVars.color.text.primary
    }
  }
})
