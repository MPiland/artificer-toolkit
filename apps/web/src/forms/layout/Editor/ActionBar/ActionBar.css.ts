import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'
import { AUTHORING_WIDE_DESKTOP_QUERY } from '../../authoringWorkspace.constants'

const mobile = 'screen and (max-width: 760px)'
const overlayRail =
  'screen and (max-width: 640px), screen and (max-width: 900px) and (orientation: portrait)'

export const root = style({
  '@layer': {
    [app]: {
      vars: {
        '--at-authoring-floating-action-size': '44px',
        '--at-authoring-floating-action-icon-size': '18px'
      },
      position: 'absolute',
      zIndex: 30,
      insetInline: 0,
      insetBlockEnd: 0,
      display: 'grid',
      alignItems: 'center',
      minHeight: `calc(var(--at-authoring-floating-action-size) + ${foundationVars.space[4]})`,
      borderTop: 0,
      borderRight: 0,
      borderBottom: 0,
      borderLeft: 0,
      overflow: 'visible',
      pointerEvents: 'none',
      '@media': {
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          borderBlockStart: `1px solid ${foundationVars.color.authoring.border}`,
          backgroundColor: foundationVars.color.authoring.dock
        }
      }
    }
  }
})

export const padded = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]} calc(${foundationVars.space[2]} + env(safe-area-inset-bottom))`,
      '@media': {
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          padding: foundationVars.space[3]
        },
        [overlayRail]: {
          minHeight: 56
        },
        [mobile]: {
          padding: `${foundationVars.space[2]} ${foundationVars.space[3]} calc(${foundationVars.space[2]} + env(safe-area-inset-bottom))`
        }
      }
    }
  }
})

export const flush = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[2]} 0 calc(${foundationVars.space[2]} + env(safe-area-inset-bottom))`,
      '@media': {
        [mobile]: {
          padding: `${foundationVars.space[4]} ${foundationVars.space[4]} calc(${foundationVars.space[4]} + env(safe-area-inset-bottom))`
        }
      }
    }
  }
})

export const canvasSurface = style({
  '@layer': {
    [app]: {
      backgroundColor: 'transparent'
    }
  }
})

export const headerSurface = style({
  '@layer': {
    [app]: {
      backgroundColor: 'transparent'
    }
  }
})

export const inner = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'center',
      gap: foundationVars.space[3],
      width: '100%',
      maxWidth: 'var(--at-authoring-action-max-width, none)',
      marginInline: 'auto',
      pointerEvents: 'none',
      '@media': {
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          minBlockSize: 48,
          padding: 0,
          border: 0,
          borderRadius: 0,
          backgroundColor: 'transparent'
        },
        [overlayRail]: {
          gridTemplateColumns: 'auto 1fr auto',
          maxWidth: 'none'
        },
        [mobile]: {
          gridTemplateColumns: 'auto 1fr auto'
        }
      }
    }
  }
})

export const start = style({
  '@layer': {
    [app]: {
      display: 'flex',
      gridColumn: '1',
      justifyContent: 'flex-start',
      pointerEvents: 'none',
      '@media': {
        [overlayRail]: {
          gridColumn: '1',
          gridRow: '1'
        },
        [mobile]: {
          gridColumn: '1',
          gridRow: '1'
        }
      }
    }
  }
})

export const end = style({
  '@layer': {
    [app]: {
      display: 'flex',
      gridColumn: '3',
      justifyContent: 'flex-end',
      pointerEvents: 'none',
      '@media': {
        [overlayRail]: {
          gridColumn: '3',
          gridRow: '1'
        },
        [mobile]: {
          gridColumn: '3',
          gridRow: '1',
          justifyContent: 'flex-end'
        }
      }
    }
  }
})

export const secondaryButton = style({
  '@layer': {
    [app]: {
      inlineSize: 'var(--at-authoring-floating-action-size)',
      blockSize: 'var(--at-authoring-floating-action-size)',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.surface.raised,
      color: foundationVars.color.text.secondary,
      boxShadow: foundationVars.shadow.floatingControl,
      pointerEvents: 'auto',
      ':hover': {
        backgroundColor: foundationVars.color.surface.emphasized,
        color: foundationVars.color.text.primary
      },
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      },
      ':disabled': {
        borderColor: foundationVars.color.border.subtle,
        backgroundColor: foundationVars.color.surface.subtle,
        color: foundationVars.color.text.dim,
        boxShadow: 'none',
        cursor: 'default'
      },
      '@media': {
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          gap: foundationVars.space[2],
          inlineSize: 'auto',
          minInlineSize: '7rem',
          blockSize: 44,
          paddingInline: foundationVars.space[4],
          borderRadius: foundationVars.radius.md,
          boxShadow: 'none'
        }
      }
    }
  }
})

export const primaryButton = style({
  '@layer': {
    [app]: {
      inlineSize: 'var(--at-authoring-floating-action-size)',
      blockSize: 'var(--at-authoring-floating-action-size)',
      border: `1px solid ${foundationVars.color.button.primary.border}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.button.primary.background,
      color: foundationVars.color.button.primary.text,
      boxShadow: foundationVars.shadow.floatingControl,
      pointerEvents: 'auto',
      ':hover': {
        backgroundColor: foundationVars.color.button.primary.hover,
        color: foundationVars.color.button.primary.text
      },
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      },
      ':disabled': {
        borderColor: foundationVars.color.border.strong,
        backgroundColor: foundationVars.color.surface.subtle,
        color: foundationVars.color.text.muted,
        boxShadow: 'none',
        cursor: 'default'
      },
      '@media': {
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          gap: foundationVars.space[2],
          inlineSize: 'auto',
          minInlineSize: '7.5rem',
          blockSize: 44,
          paddingInline: foundationVars.space[4],
          borderRadius: foundationVars.radius.md,
          backgroundColor: foundationVars.color.accent.solid,
          borderColor: foundationVars.color.accent.solid,
          color: foundationVars.color.accent.contrast,
          boxShadow: 'none'
        }
      }
    }
  }
})

export const icon = style({
  '@layer': {
    [app]: {
      inlineSize: 'var(--at-authoring-floating-action-icon-size)',
      blockSize: 'var(--at-authoring-floating-action-icon-size)'
    }
  }
})

export const buttonLabel = style({
  '@layer': {
    [app]: {
      display: 'none',
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.bodySm.lineHeight,
      '@media': {
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          display: 'inline'
        }
      }
    }
  }
})
