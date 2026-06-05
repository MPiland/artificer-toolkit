import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

const mobile = 'screen and (max-width: 640px)'

export const fieldGrid = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateColumns': 'repeat(auto-fit, minmax(8.5rem, 1fr))',
      'gap': foundationVars.space[3],
      'paddingInline': foundationVars.space[4],
      'paddingBlockEnd': foundationVars.space[4],
      '@media': {
        [mobile]: {
          gridTemplateColumns: 'minmax(0, 1fr)'
        }
      }
    }
  }
})

export const fieldLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.label.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.label.lineHeight
    }
  }
})

export const fieldInput = style({
  '@layer': {
    [app]: {
      minBlockSize: 40,
      borderColor: foundationVars.color.input.border.default,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      ':focus': {
        borderColor: foundationVars.color.input.border.focus
      },
      ':focus-within': {
        borderColor: foundationVars.color.input.border.focus
      }
    }
  }
})
