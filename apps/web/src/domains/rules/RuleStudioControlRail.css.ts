import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css'
import { app } from '../../css/layers.css'

export const root = style({
  '@layer': {
    [app]: {
      blockSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0,
      padding: foundationVars.space[2],
      overflow: 'auto',
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const item = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      borderColor: foundationVars.color.border.subtle,
      backgroundColor: foundationVars.color.surface.panel,
      selectors: {
        '&[data-active]': {
          borderColor: foundationVars.color.accent.emphasisBorder,
          backgroundColor: foundationVars.color.surface.panel
        }
      }
    }
  }
})

export const control = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.surface.subtle,
      color: foundationVars.color.text.primary,
      transition: `background-color ${foundationVars.motion.fast}, color ${foundationVars.motion.fast}`,
      selectors: {
        '&:hover': {
          backgroundColor: foundationVars.color.surface.raised
        },
        [`${item}[data-active] &`]: {
          backgroundColor: foundationVars.color.accent.soft,
          color: foundationVars.color.text.accent
        },
        [`${item}[data-active] &:hover`]: {
          backgroundColor: foundationVars.color.accent.soft
        }
      }
    }
  }
})

export const panel = style({
  '@layer': {
    [app]: {
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.panel,
      color: foundationVars.color.text.primary
    }
  }
})
