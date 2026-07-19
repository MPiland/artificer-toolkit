import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const tooltipTarget = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      flexShrink: 0
    }
  }
})

export const headerIconButton = style({
  '@layer': {
    [app]: {
      inlineSize: 44,
      blockSize: 44,
      flexShrink: 0,
      border: '1px solid transparent',
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.subtle,
      color: foundationVars.color.text.muted,
      ':hover': {
        backgroundColor: foundationVars.color.surface.raised,
        color: foundationVars.color.text.secondary
      },
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      },
      ':disabled': {
        backgroundColor: foundationVars.color.surface.subtle,
        color: foundationVars.color.text.muted,
        cursor: 'default'
      },
      selectors: {
        '&.isDestructive': {
          borderColor: foundationVars.color.status.danger,
          backgroundColor: foundationVars.color.status.dangerSoft,
          color: foundationVars.color.status.danger,
          cursor: 'pointer'
        },
        '&.isDestructive:hover': {
          backgroundColor: foundationVars.color.status.dangerSoft,
          color: foundationVars.color.status.danger
        },
        '&[data-active="true"]': {
          borderColor: foundationVars.color.accent.border,
          backgroundColor: foundationVars.color.accent.soft,
          color: foundationVars.color.text.accent
        },
        '&[data-active="true"]:hover': {
          backgroundColor: foundationVars.color.accent.soft,
          color: foundationVars.color.text.accent
        },
        '&[data-disabled="true"]': {
          borderColor: 'transparent',
          backgroundColor: foundationVars.color.surface.subtle,
          color: foundationVars.color.text.muted,
          cursor: 'default'
        },
        '&[data-disabled="true"]:hover': {
          backgroundColor: foundationVars.color.surface.subtle,
          color: foundationVars.color.text.muted,
          cursor: 'default'
        },
        '&&:disabled': {
          cursor: 'default'
        },
        '&&:disabled:hover': {
          backgroundColor: foundationVars.color.surface.subtle,
          color: foundationVars.color.text.muted,
          cursor: 'default'
        }
      }
    }
  }
})

export const lifecycleButton = style({
  '@layer': {
    [app]: {
      inlineSize: 124,
      minInlineSize: 124,
      minBlockSize: 44,
      flexShrink: 0,
      borderRadius: foundationVars.radius.sm,
      fontWeight: foundationVars.fontWeight.semibold,
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const activateButton = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.button.primary.border,
      backgroundColor: foundationVars.color.button.primary.background,
      color: foundationVars.color.button.primary.text,
      ':hover': {
        backgroundColor: foundationVars.color.button.primary.hover,
        color: foundationVars.color.button.primary.text
      },
      ':active': {
        backgroundColor: foundationVars.color.button.primary.active
      },
      ':disabled': {
        borderColor: foundationVars.color.border.strong,
        backgroundColor: foundationVars.color.surface.subtle,
        color: foundationVars.color.text.muted
      }
    }
  }
})

export const confirmationActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2],
      marginBlockStart: foundationVars.space[5]
    }
  }
})

export const confirmationText = style({
  '@layer': {
    [app]: {
      marginBlock: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: '20px'
    }
  }
})
