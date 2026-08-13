import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css'
import { app } from '../../css/layers.css'

export const root = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space[3],
      minBlockSize: 0,
      padding: foundationVars.space[3],
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.subtle,
      color: foundationVars.color.text.primary
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1]
    }
  }
})

export const heading = style({
  '@layer': {
    [app]: {
      margin: 0,
      fontFamily: foundationVars.font.sans,
      fontSize: foundationVars.typography.label.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.label.lineHeight
    }
  }
})

export const hint = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const list = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const item = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      minBlockSize: '2.5rem',
      paddingInline: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card,
      color: foundationVars.color.text.primary,
      cursor: 'grab',
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.caption.lineHeight,
      transition: `border-color ${foundationVars.motion.fast}, background-color ${foundationVars.motion.fast}, box-shadow ${foundationVars.motion.fast}`,
      userSelect: 'none',
      selectors: {
        '&:hover:not([data-disabled])': {
          borderColor: foundationVars.color.border.strong,
          backgroundColor: foundationVars.color.surface.raised,
          boxShadow: foundationVars.shadow.cardHover
        },
        '&:active:not([data-disabled])': {
          cursor: 'grabbing'
        },
        '&[data-disabled]': {
          boxShadow: 'none',
          cursor: 'not-allowed',
          opacity: 0.5
        }
      }
    }
  }
})

export const icon = style({
  '@layer': {
    [app]: {
      display: 'grid',
      flex: '0 0 auto',
      inlineSize: '1.125rem',
      blockSize: '1.125rem',
      placeItems: 'center',
      color: foundationVars.color.icon.default
    }
  }
})
