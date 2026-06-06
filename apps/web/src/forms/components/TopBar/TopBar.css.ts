import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

const tablet = 'screen and (max-width: 900px)'
const mobile = 'screen and (max-width: 640px)'

export const root = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'alignItems': 'center',
      'justifyContent': 'space-between',
      'gap': foundationVars.space[3],
      'inlineSize': '100%',
      'minBlockSize': 48,
      'paddingInline': foundationVars.space[4],
      'borderBlockEnd': `1px solid ${foundationVars.color.border.strong}`,
      'backgroundColor': foundationVars.color.surface.header,
      'color': foundationVars.color.text.primary,
      'boxShadow': '0 1px 0 rgba(255, 255, 255, 0.02)',
      '@media': {
        [mobile]: {
          paddingInline: foundationVars.space[3]
        }
      }
    }
  }
})

export const leftCluster = style({
  '@layer': {
    [app]: {
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
      'display': 'flex',
      'alignItems': 'center',
      'gap': foundationVars.space[2],
      'flexShrink': 0,
      '@media': {
        [tablet]: {
          display: 'none'
        }
      }
    }
  }
})

export const iconButton = style({
  '@layer': {
    [app]: {
      'display': 'inline-flex',
      'alignItems': 'center',
      'justifyContent': 'center',
      'inlineSize': 32,
      'blockSize': 32,
      'padding': 0,
      'border': `1px solid transparent`,
      'borderRadius': foundationVars.radius.sm,
      'backgroundColor': 'transparent',
      'color': foundationVars.color.text.secondary,
      'cursor': 'pointer',
      'transition': `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,
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

export const iconButtonPressed = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.border.subtle,
      backgroundColor: foundationVars.color.surface.subtle,
      color: foundationVars.color.text.primary
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
      color: foundationVars.color.icon.accent
    }
  }
})

export const brandName = style({
  '@layer': {
    [app]: {
      'fontSize': '16px',
      'fontWeight': foundationVars.fontWeight.bold,
      'lineHeight': '20px',
      '@media': {
        [mobile]: {
          display: 'none'
        }
      }
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

export const breadcrumbs = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'alignItems': 'center',
      'gap': foundationVars.space[1],
      'minInlineSize': 0,
      'color': foundationVars.color.text.secondary,
      'fontSize': foundationVars.typography.bodySm.fontSize,
      'lineHeight': foundationVars.typography.bodySm.lineHeight,
      '@media': {
        [mobile]: {
          display: 'none'
        }
      }
    }
  }
})

export const crumbGroup = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minInlineSize: 0
    }
  }
})

export const crumb = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const crumbCurrent = style([
  crumb,
  {
    '@layer': {
      [app]: {
        color: foundationVars.color.text.primary,
        fontWeight: foundationVars.fontWeight.semibold
      }
    }
  }
])

export const crumbSeparator = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      flexShrink: 0
    }
  }
})

export const statusBadge = style({
  '@layer': {
    [app]: {
      'display': 'inline-flex',
      'alignItems': 'center',
      'gap': foundationVars.space[1],
      'minBlockSize': 22,
      'paddingInline': foundationVars.space[2],
      'border': `1px solid ${foundationVars.color.accent.border}`,
      'borderRadius': foundationVars.radius.sm,
      'backgroundColor': foundationVars.color.accent.soft,
      'color': foundationVars.color.text.accent,
      'fontSize': '12px',
      'fontWeight': foundationVars.fontWeight.bold,
      'lineHeight': '16px',
      'flexShrink': 0,
      '@media': {
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
      'display': 'inline-flex',
      'alignItems': 'center',
      'gap': foundationVars.space[2],
      'minBlockSize': 32,
      'padding': `${foundationVars.space[1]} ${foundationVars.space[2]}`,
      'border': `1px solid transparent`,
      'borderRadius': foundationVars.radius.sm,
      'backgroundColor': 'transparent',
      'color': foundationVars.color.text.primary,
      'fontSize': '12px',
      'fontWeight': foundationVars.fontWeight.semibold,
      'cursor': 'pointer',
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

export const visuallyHidden = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
      border: 0
    }
  }
})
