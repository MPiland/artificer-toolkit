import { style, styleVariants } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const itemRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '18px 24px minmax(0, 1fr) 22px',
      alignItems: 'center',
      gap: foundationVars.space[1],
      paddingBlock: foundationVars.space[1],
      inlineSize: '100%',
      color: foundationVars.color.text.secondary,
      cursor: 'pointer',
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,
      ':hover': {
        backgroundColor: foundationVars.color.nav.pillHover,
        color: foundationVars.color.text.primary
      },
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      },
      selectors: {
        [`&.active`]: {
          position: 'relative',
          color: foundationVars.color.text.accent,
          backgroundColor: foundationVars.color.surface.subtle
        },
        ['&.active::after']: {
          content: "''",
          position: 'absolute',
          insetBlock: 0,
          insetInlineStart: 0,
          inlineSize: 3,
          backgroundColor: foundationVars.color.accent.solid,
          borderRadius: 'unset'
        }
      }
    }
  }
})

export const levelClass = [
  style({
    '@layer': {
      [app]: {
        paddingInlineStart: foundationVars.space[2]
      }
    }
  }),
  style({
    '@layer': {
      [app]: {
        paddingInlineStart: foundationVars.space[5]
      }
    }
  }),
  style({
    '@layer': {
      [app]: {
        paddingInlineStart: foundationVars.space[8]
      }
    }
  }),
  style({
    '@layer': {
      [app]: {
        paddingInlineStart: foundationVars.space[10]
      }
    }
  })
] as const

export const itemRowMuted = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted
    }
  }
})

export const expander = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: foundationVars.color.text.muted
    }
  }
})

export const itemIcon = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      inlineSize: 20,
      blockSize: 20,
      color: 'inherit',
      opacity: 0.82
    }
  }
})

export const itemText = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 1,
      minInlineSize: 0
    }
  }
})

export const itemLabel = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: 'inherit',
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.bodySm.lineHeight,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const childGroup = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
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
