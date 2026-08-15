import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css'
import { app } from '../../css/layers.css'

export const root = style({
  '@layer': {
    [app]: {
      blockSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0
    }
  }
})

export const canvas = style({
  '@layer': {
    [app]: {
      position: 'relative',
      blockSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

export const focusControl = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      zIndex: 6,
      insetInlineStart: '3.5rem',
      insetBlockEnd: foundationVars.space[3],
      borderColor: foundationVars.color.border.strong,
      backgroundColor: foundationVars.color.surface.panel,
      color: foundationVars.color.icon.default,
      boxShadow: foundationVars.shadow.floatingControl,
      selectors: {
        '&:hover': {
          borderColor: foundationVars.color.accent.emphasisBorder,
          backgroundColor: foundationVars.color.surface.raised,
          color: foundationVars.color.icon.accent
        },
        '&[aria-pressed="true"]': {
          borderColor: foundationVars.color.accent.emphasisBorder,
          backgroundColor: foundationVars.color.accent.soft,
          color: foundationVars.color.icon.accent
        }
      }
    }
  }
})

globalStyle(`${canvas} .grl-dg__aside__menu`, {
  '@layer': {
    [app]: {
      display: 'none'
    }
  }
})
