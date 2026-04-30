import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const nav = style({
  '@layer': {
    [app]: {
      display: 'block'
    }
  }
})

export const list = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: foundationVars.space[2],
      rowGap: foundationVars.space[1],
      margin: 0,
      padding: 0,
      listStyle: 'none'
    }
  },
  '@media': {
    [mobile]: {
      alignItems: 'flex-start'
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
          fontSize: foundationVars.typography.caption.fontSize,
          lineHeight: foundationVars.typography.caption.lineHeight,
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
      'minWidth': 0,
      'padding': 0,
      'border': 0,
      'borderRadius': foundationVars.radius.sm,
      'backgroundColor': 'transparent',
      'color': foundationVars.color.text.accent,
      'fontSize': foundationVars.typography.caption.fontSize,
      'fontWeight': foundationVars.fontWeight.medium,
      'lineHeight': foundationVars.typography.caption.lineHeight,
      'textAlign': 'left',
      'transition': `color ${foundationVars.motion.fast} ease`,

      ':hover': {
        color: foundationVars.color.accent.hover,
        textDecoration: 'underline'
      },

      ':focus-visible': {
        boxShadow: foundationVars.shadow.focus,
        outline: 'none'
      }
    }
  }
})

export const stepButtonActive = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.semibold,
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
