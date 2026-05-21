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
          '@layer': {
            [app]: {
              minHeight: '44px'
            }
          }
        }
      }
    }
  }
})

export const stepButtonActive = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.accent.tertiarySolid,
      fontWeight: foundationVars.fontWeight.bold,
      textDecoration: 'none'
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

export const errorDot = style({
  '@layer': {
    [app]: {
      display: 'inline-block',
      width: 6,
      height: 6,
      marginLeft: foundationVars.space[1],
      borderRadius: 9999,
      backgroundColor: foundationVars.color.status.danger
    }
  }
})
