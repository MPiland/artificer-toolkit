import { style, styleVariants } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const statusMarker = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      inlineSize: 18,
      blockSize: 18,
      borderRadius: foundationVars.radius.sm
    }
  }
})

export const statusClass = styleVariants({
  complete: {
    '@layer': {
      [app]: {
        color: foundationVars.color.status.success
      }
    }
  },
  dirty: {
    '@layer': {
      [app]: {
        color: foundationVars.color.accent.solid
      }
    }
  },
  warning: {
    '@layer': {
      [app]: {
        color: foundationVars.color.status.warning
      }
    }
  },
  error: {
    '@layer': {
      [app]: {
        color: foundationVars.color.status.danger
      }
    }
  },
  empty: {
    '@layer': {
      [app]: {
        color: foundationVars.color.text.dim
      }
    }
  }
})
