import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const nav = style({
  '@layer': {
    [app]: {
      display: 'block',
      minWidth: 0,
      overflowX: 'auto',
      scrollbarWidth: 'thin'
    }
  }
})

export const navRail = style({
  '@layer': {
    [app]: {
      overflowX: 'visible',
      scrollbarWidth: 'auto'
    }
  }
})

export const list = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'flexWrap': 'nowrap',
      'alignItems': 'center',
      'columnGap': foundationVars.space[2],
      'rowGap': foundationVars.space[1],
      'margin': 0,
      'padding': 0,
      'listStyle': 'none',
      '@media': {
        [mobile]: {
          alignItems: 'flex-start'
        }
      }
    }
  }
})

export const listRail = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignItems: 'stretch',
      gap: 2,
      paddingBlock: foundationVars.space[1]
    }
  }
})

export const item = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      minWidth: 0,

      selectors: {
        '&:not(:last-child)::after': {
          content: '/',
          marginLeft: foundationVars.space[2],
          color: foundationVars.color.text.muted,
          fontSize: foundationVars.typography.bodySm.fontSize,
          lineHeight: foundationVars.typography.bodySm.lineHeight,
          userSelect: 'none'
        }
      }
    }
  }
})

export const itemRail = style({
  '@layer': {
    [app]: {
      display: 'block',

      selectors: {
        '&:not(:last-child)::after': {
          content: 'none'
        }
      }
    }
  }
})

export const stepButton = style({
  '@layer': {
    [app]: {
      'display': 'inline-flex',
      'alignItems': 'center',
      'justifyContent': 'center',
      'minWidth': '44px',
      'minHeight': '32px',
      'padding': 0,
      'border': 0,
      'borderRadius': foundationVars.radius.sm,
      'backgroundColor': 'transparent',
      'color': foundationVars.color.text.secondary,
      'fontSize': foundationVars.typography.bodySm.fontSize,
      'fontWeight': foundationVars.fontWeight.medium,
      'lineHeight': foundationVars.typography.bodySm.lineHeight,
      'textAlign': 'left',
      'transition': `color ${foundationVars.motion.fast} ease`,

      ':hover': {
        color: foundationVars.color.accent.hover,
        textDecoration: 'underline'
      },

      ':focus-visible': {
        boxShadow: foundationVars.shadow.focus,
        outline: 'none'
      },
      '@media': {
        [mobile]: {
          minHeight: '44px'
        }
      }
    }
  }
})

export const stepButtonRail = style({
  '@layer': {
    [app]: {
      justifyContent: 'space-between',
      gap: foundationVars.space[2],
      width: '100%',
      minHeight: '34px',
      padding: `${foundationVars.space[1]} ${foundationVars.space[2]}`,
      border: `1px solid transparent`,
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.secondary,
      textDecoration: 'none',
      backgroundColor: 'transparent',
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,

      ':hover': {
        borderColor: foundationVars.color.border.subtle,
        backgroundColor: foundationVars.color.nav.pillHover,
        color: foundationVars.color.text.primary,
        textDecoration: 'none'
      }
    }
  }
})

export const stepButtonActive = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent,
      fontWeight: foundationVars.fontWeight.bold,
      textDecoration: 'none'
    }
  }
})

export const stepButtonRailActive = style({
  '@layer': {
    [app]: {
      borderColor: 'transparent',
      backgroundColor: 'rgba(236, 106, 6, 0.1)',
      color: foundationVars.color.text.primary,
      boxShadow: `inset 2px 0 0 ${foundationVars.color.accent.solid}`
    }
  }
})

export const stepButtonError = style({
  '@layer': {
    [app]: {
      'color': foundationVars.color.status.danger,

      ':hover': {
        color: foundationVars.color.status.danger
      }
    }
  }
})

export const stepButtonLabel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '16px minmax(0, 1fr)',
      alignItems: 'center',
      columnGap: foundationVars.space[1],
      minWidth: 0
    }
  }
})

export const stepMarker = style({
  '@layer': {
    [app]: {
      display: 'inline-block',
      width: 8,
      height: 8,
      justifySelf: 'center',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.xs,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const stepMarkerActive = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.solid,
      backgroundColor: foundationVars.color.accent.solid
    }
  }
})

export const stepLabel = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const stepDescription = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.muted,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.regular,
      lineHeight: '16px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const statusMeta = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      flexShrink: 0,
      color: foundationVars.color.text.muted,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: '16px'
    }
  }
})

export const statusLabel = style({
  '@layer': {
    [app]: {
      display: 'inline-block'
    }
  }
})

export const statusDot = style({
  '@layer': {
    [app]: {
      display: 'inline-block',
      width: 8,
      height: 8,
      marginLeft: foundationVars.space[1],
      borderRadius: 9999,
      backgroundColor: foundationVars.color.text.muted
    }
  }
})

export const statusDotDirty = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.accent.solid
    }
  }
})

export const statusDotWarning = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.status.warning
    }
  }
})

export const statusDotError = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.status.danger
    }
  }
})
