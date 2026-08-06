import { style } from '@vanilla-extract/css'
import { foundationVars } from '../css/foundations.css.ts'
import { app } from '../css/layers.css.ts'

const tabletPortrait = 'screen and (max-width: 900px) and (orientation: portrait)'
const compact = 'screen and (max-width: 760px)'
const mobile = 'screen and (max-width: 640px)'

export const canvas = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      blockSize: '100dvh',
      minBlockSize: '100dvh',
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary
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
      flex: 1,
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
      boxSizing: 'border-box',
      gridArea: 'main',
      flex: 1,
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.canvas,
      ':focus': {
        outline: 'none'
      },
      '@media': {
        [tabletPortrait]: {
          blockSize: 'calc(100% - 58px)',
          overflow: 'hidden'
        },
        [mobile]: {
          blockSize: 'calc(100% - 58px)',
          overflow: 'hidden'
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
        [compact]: {
          alignContent: 'stretch',
          blockSize: '100%'
        },
        [mobile]: {
          inlineSize: '100%',
          gap: foundationVars.space[6],
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const contentAreaWide = style({
  '@layer': {
    [app]: {
      inlineSize: '100%'
    }
  }
})

export const searchDrawerContent = style({
  '@layer': {
    [app]: {
      borderBlockStart: `1px solid ${foundationVars.color.border.strong}`,
      backgroundColor: foundationVars.color.surface.panel,
      color: foundationVars.color.text.primary
    }
  }
})

export const searchDrawerHeader = style({
  '@layer': {
    [app]: {
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`
    }
  }
})

export const searchDrawerBody = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[4]
    }
  }
})

export const searchDrawerStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3]
    }
  }
})

export const userIconButton = style({
  '@layer': {
    [app]: {
      inlineSize: 36,
      blockSize: 36,
      overflow: 'hidden',
      borderRadius: foundationVars.radius.md
    }
  }
})

export const userAvatarImage = style({
  '@layer': {
    [app]: {
      display: 'block',
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }
})

export const headerMenuButton = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: foundationVars.space[2],
      minBlockSize: 36,
      paddingInline: foundationVars.space[3],
      border: '1px solid transparent',
      borderRadius: foundationVars.radius.sm,
      backgroundColor: 'transparent',
      color: foundationVars.color.text.accent,
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: foundationVars.fontWeight.regular,
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,
      ':hover': {
        borderColor: foundationVars.color.border.subtle,
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

export const themeSelector = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.recessed,
      margin: `0 ${foundationVars.space[2]} ${foundationVars.space[2]}`
    }
  }
})

export const themeSelectorLabel = style({
  '@layer': {
    [app]: {
      height: foundationVars.space[6]
    }
  }
})

export const themeSelectorOption = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: foundationVars.space[1],
      whiteSpace: 'nowrap',
      width: '100%',
      height: '100%'
    }
  }
})

export const pageHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '0.25rem',
      minInlineSize: 0,
      maxInlineSize: '100%'
    }
  }
})

export const pageHeaderTitleRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: foundationVars.space[4],
      minInlineSize: 0,
      maxInlineSize: '100%'
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
      minInlineSize: 0,
      maxInlineSize: 'min(100%, 44rem)',
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
      justifySelf: 'end',
      gap: foundationVars.space[2]
    }
  }
})
