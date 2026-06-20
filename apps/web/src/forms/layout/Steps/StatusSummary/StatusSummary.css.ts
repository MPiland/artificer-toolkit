import { style, styleVariants } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const summaryItem = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minInlineSize: 0,
      color: foundationVars.color.text.secondary
    }
  }
})

export const summaryValue = style({
  '@layer': {
    [app]: {
      color: 'inherit',
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: '14px',
      whiteSpace: 'nowrap'
    }
  }
})

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
  incomplete: {
    '@layer': {
      [app]: {
        color: foundationVars.color.text.dim
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
