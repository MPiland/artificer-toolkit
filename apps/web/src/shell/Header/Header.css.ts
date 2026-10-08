import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const tabletPortrait = 'screen and (max-width: 900px) and (orientation: portrait)'
const mobile = 'screen and (max-width: 640px)'

export const root = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
      alignItems: 'center',
      gap: foundationVars.space[3],
      inlineSize: '100%',
      minBlockSize: 56,
      paddingInline: foundationVars.space[4],
      borderBlockEnd: `1px solid ${foundationVars.color.border.strong}`,
      backgroundColor: foundationVars.color.surface.header,
      color: foundationVars.color.text.primary,
      '@media': {
        [tabletPortrait]: {
          gridTemplateColumns: 'minmax(0, 1fr) auto'
        },
        [mobile]: {
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          paddingInline: foundationVars.space[3]
        }
      }
    }
  }
})

export const leftCluster = style({
  '@layer': {
    [app]: {
      gridColumn: '1',
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[3],
      minInlineSize: 0
    }
  }
})

export const rightCluster = style({
  '@layer': {
    [app]: {
      gridColumn: '3',
      justifySelf: 'end',
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      flexShrink: 0,
      '@media': {
        [tabletPortrait]: {
          display: 'none'
        },
        [mobile]: {
          display: 'none'
        }
      }
    }
  }
})

export const mobileActionCluster = style({
  '@layer': {
    [app]: {
      gridColumn: '2',
      justifySelf: 'end',
      display: 'none',
      alignItems: 'center',
      gap: foundationVars.space[1],
      flexShrink: 0,
      marginInlineStart: 'auto',
      '@media': {
        [tabletPortrait]: {
          display: 'inline-flex'
        },
        [mobile]: {
          display: 'inline-flex'
        }
      }
    }
  }
})

export const brand = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      flexShrink: 0
    }
  }
})

export const logo = style({
  '@layer': {
    [app]: {
      inlineSize: 36,
      blockSize: 36,
      color: foundationVars.color.icon.accent
    }
  }
})

export const brandName = style({
  '@layer': {
    [app]: {
      fontSize: '16px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '20px',
      '@media': {
        [mobile]: {
          display: 'none'
        }
      }
    }
  }
})

export const supplement = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minBlockSize: 24,
      paddingInline: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '16px',
      whiteSpace: 'nowrap'
    }
  }
})

export const divider = style({
  '@layer': {
    [app]: {
      display: 'inline-block',
      inlineSize: 1,
      blockSize: 18,
      backgroundColor: foundationVars.color.border.strong,
      flexShrink: 0
    }
  }
})

export const navigationActions = style({
  '@layer': {
    [app]: {
      gridColumn: '2',
      justifySelf: 'center',
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      flexShrink: 0,
      '@media': {
        [tabletPortrait]: {
          display: 'none'
        },
        [mobile]: {
          display: 'none'
        }
      }
    }
  }
})

export const searchRoot = style({
  '@layer': {
    [app]: {
      inlineSize: 'min(20vw, 16rem)',
      minInlineSize: '11rem'
    }
  }
})

export const searchWrapper = style({
  '@layer': {
    [app]: {
      blockSize: 32,
      color: foundationVars.color.text.muted
    }
  }
})

export const searchSection = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted
    }
  }
})

export const searchInput = style({
  '@layer': {
    [app]: {
      minBlockSize: 32,
      blockSize: 32,
      paddingInlineStart: '2rem',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight,
      '::placeholder': {
        color: foundationVars.color.text.muted,
        opacity: 1
      }
    }
  }
})

export const accountButton = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      minBlockSize: 36,
      padding: `${foundationVars.space[1]} ${foundationVars.space[3]}`,
      border: `1px solid transparent`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: 'transparent',
      color: foundationVars.color.text.primary,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.semibold,
      cursor: 'pointer',
      ':hover': {
        borderColor: foundationVars.color.border.subtle,
        backgroundColor: foundationVars.color.surface.subtle
      },
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const accountAvatar = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      inlineSize: 24,
      blockSize: 24,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.accent.solid,
      color: foundationVars.color.accent.contrast,
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: 1
    }
  }
})

export const accountLabel = style({
  '@layer': {
    [app]: {
      whiteSpace: 'nowrap'
    }
  }
})
