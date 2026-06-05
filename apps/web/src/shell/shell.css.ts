import { style } from '@vanilla-extract/css'
import { foundationVars } from '../css/foundations.css.ts'
import { app } from '../css/layers.css.ts'

const tabletPortrait = 'screen and (max-width: 900px) and (orientation: portrait)'
const mobile = 'screen and (max-width: 640px)'

export const canvas = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      blockSize: '100dvh',
      minBlockSize: '100dvh',
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary
    }
  }
})

export const workspace = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateAreas: '"rail main"',
      gridTemplateColumns: 'minmax(16rem, 20rem) minmax(0, 1fr)',
      gridTemplateRows: 'minmax(0, 1fr)',
      blockSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      '@media': {
        [tabletPortrait]: {
          gridTemplateAreas: '"main"',
          gridTemplateColumns: 'minmax(0, 1fr)'
        },
        [mobile]: {
          gridTemplateAreas: '"main"',
          gridTemplateColumns: 'minmax(0, 1fr)'
        }
      }
    }
  }
})

export const workspaceNoRail = style({
  '@layer': {
    [app]: {
      gridTemplateAreas: '"main"',
      gridTemplateColumns: 'minmax(0, 1fr)'
    }
  }
})

export const railSlot = style({
  '@layer': {
    [app]: {
      gridArea: 'rail',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const navigationDrawerContent = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      blockSize: '100%',
      minBlockSize: 0,
      overflow: 'hidden',
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.primary
    }
  }
})

export const navigationDrawerBody = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      blockSize: '100%',
      minBlockSize: 0,
      overflow: 'hidden',
      padding: 0,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const navigationDrawerRailMount = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      blockSize: '100%',
      inlineSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden'
    }
  }
})

export const main = style({
  '@layer': {
    [app]: {
      gridArea: 'main',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'auto',
      backgroundColor: foundationVars.color.surface.canvas,
      ':focus': {
        outline: 'none'
      }
    }
  }
})

export const authoringMain = style({
  '@layer': {
    [app]: {
      gridArea: 'main',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.canvas,
      ':focus': {
        outline: 'none'
      },
      '@media': {
        [tabletPortrait]: {
          paddingBlockEnd: '58px',
          overflow: 'auto'
        },
        [mobile]: {
          paddingBlockEnd: '58px',
          overflow: 'auto'
        }
      }
    }
  }
})

export const contentArea = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[8],
      inlineSize: 'min(100%, 80rem)',
      minBlockSize: '100%',
      minInlineSize: 0,
      marginInline: 'auto',
      padding: `${foundationVars.space[8]} ${foundationVars.space[6]}`,
      '@media': {
        [mobile]: {
          inlineSize: '100%',
          gap: foundationVars.space[6],
          padding: `${foundationVars.space[4]} ${foundationVars.space[4]} ${foundationVars.space[8]}`
        }
      }
    }
  }
})

export const mobileFooterSlot = style({
  '@layer': {
    [app]: {
      display: 'none',
      '@media': {
        [tabletPortrait]: {
          position: 'fixed',
          insetInline: 0,
          insetBlockEnd: 0,
          zIndex: 190,
          display: 'block'
        },
        [mobile]: {
          position: 'fixed',
          insetInline: 0,
          insetBlockEnd: 0,
          zIndex: 190,
          display: 'block'
        }
      }
    }
  }
})

export const userIconButton = style({
  '@layer': {
    [app]: {
      inlineSize: 36,
      blockSize: 36,
      borderRadius: foundationVars.radius.md
    }
  }
})

export const headerMenuButton = style({
  '@layer': {
    [app]: {
      minBlockSize: 36,
      blockSize: 36,
      paddingInline: foundationVars.space[4],
      border: `1px solid var(--shell-menu-button-border, ${foundationVars.color.button.primary.border})`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: `var(--shell-menu-button-background, ${foundationVars.color.button.primary.background})`,
      color: `var(--shell-menu-button-text, ${foundationVars.color.button.primary.text})`,
      fontSize: '0.875rem',
      fontWeight: foundationVars.fontWeight.bold,
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,
      ':hover': {
        borderColor: `var(--shell-menu-button-hover-border, ${foundationVars.color.button.primary.border})`,
        backgroundColor: `var(--shell-menu-button-hover-background, ${foundationVars.color.button.primary.hover})`,
        color: `var(--shell-menu-button-hover-text, ${foundationVars.color.button.primary.text})`
      },
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const menuItemText = style({
  '@layer': {
    [app]: {
      display: 'block',
      minInlineSize: 0,
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

export const pageHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: foundationVars.space[6],
      '@media': {
        [mobile]: {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
    }
  }
})

export const pageHeaderCopy = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '0.25rem',
      maxInlineSize: '44rem'
    }
  }
})

export const eyebrow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const pageTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.display,
      fontSize: foundationVars.typography.heading.fontSize,
      fontWeight: foundationVars.typography.heading.fontWeight,
      letterSpacing: foundationVars.typography.heading.letterSpacing,
      lineHeight: foundationVars.typography.heading.lineHeight
    }
  }
})

export const pageDescription = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const headerActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2]
    }
  }
})

export const footerActionBar = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      insetBlockEnd: foundationVars.space[4],
      zIndex: 5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card,
      '@media': {
        [mobile]: {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
    }
  }
})
