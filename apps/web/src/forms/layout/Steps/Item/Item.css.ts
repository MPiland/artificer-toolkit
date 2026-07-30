import { style, styleVariants } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

const rowSeparator = `color-mix(in srgb, ${foundationVars.color.authoring.border} 80%, transparent)`

export const itemRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '44px 24px minmax(0, 1fr) 22px',
      alignItems: 'center',
      gap: foundationVars.space[2],
      minBlockSize: 46,
      paddingInlineStart: `calc(${foundationVars.space[3]} + min(calc(var(--authoring-rail-level, 0) * ${foundationVars.space[3]}), ${foundationVars.space[7]}))`,
      paddingInlineEnd: foundationVars.space[4],
      inlineSize: '100%',
      borderBlockEnd: `1px solid ${rowSeparator}`,
      color: foundationVars.color.text.secondary,
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,
      ':hover': {
        backgroundColor: foundationVars.color.nav.pillHover,
        color: foundationVars.color.text.primary
      },
      selectors: {
        [`&.active`]: {
          position: 'relative',
          color: foundationVars.color.text.accent,
          backgroundColor: foundationVars.color.authoring.row,
          backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${foundationVars.color.accent.solid} 5%, ${foundationVars.color.authoring.active}) 0%, ${foundationVars.color.authoring.active} 52%, ${foundationVars.color.authoring.rail} 100%)`
        },
        '&.active::before': {
          position: 'absolute',
          insetBlock: 0,
          insetInlineStart: 0,
          inlineSize: 1,
          backgroundColor: foundationVars.color.accent.solid,
          content: "''"
        },
        '&[data-level="0"]': {
          gridTemplateColumns: '44px minmax(0, 1fr) 22px',
          minBlockSize: 46
        },
        '&[data-level="0"].active': {
          backgroundColor: foundationVars.color.authoring.active
        },
        '&[data-level="0"]:hover': {
          backgroundColor: foundationVars.color.authoring.active
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
      display: 'grid',
      placeItems: 'center',
      alignSelf: 'stretch',
      minBlockSize: 44,
      minInlineSize: 44,
      inlineSize: 44,
      position: 'relative',
      color: foundationVars.color.text.muted,
      transition: `background-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,
      '::after': {
        position: 'absolute',
        insetBlock: foundationVars.space[2],
        insetInlineEnd: 0,
        inlineSize: 1,
        backgroundColor: rowSeparator,
        content: "''",
        pointerEvents: 'none'
      },
      ':hover': {
        backgroundColor: foundationVars.color.authoring.active,
        color: foundationVars.color.text.primary
      },
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const expanderPlaceholder = style({
  '@layer': {
    [app]: {
      inlineSize: 44
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
      opacity: 0.9
    }
  }
})

export const itemTarget = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      alignSelf: 'stretch',
      minBlockSize: 44,
      minInlineSize: 0,
      padding: 0,
      color: 'inherit',
      textAlign: 'start',
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const itemText = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 2,
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
