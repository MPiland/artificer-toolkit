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
      minBlockSize: 44,
      paddingBlock: foundationVars.space[1],
      paddingInlineStart: `calc(${foundationVars.space[3]} + min(calc(var(--authoring-rail-level, 0) * ${foundationVars.space[3]}), ${foundationVars.space[7]}))`,
      paddingInlineEnd: foundationVars.space[3],
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
          color: foundationVars.color.text.primary,
          backgroundColor: foundationVars.color.surface.raised
        },
        ['&.active::after']: {
          content: "''",
          position: 'absolute',
          insetBlock: 0,
          insetInlineEnd: 0,
          inlineSize: 3,
          backgroundColor: foundationVars.color.accent.solid,
          borderRadius: 'unset'
        }
      }
    }
  }
})

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
        color: foundationVars.color.status.warning
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
