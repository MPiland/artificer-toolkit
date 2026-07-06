import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const workspaceContent = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: '1 1 auto',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden'
    }
  }
})

export const tooltipTarget = style({
  '@layer': {
    [app]: {
      display: 'inline-flex'
    }
  }
})

export const headerIconButton = style({
  '@layer': {
    [app]: {
      inlineSize: 24,
      blockSize: 24,
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

export const mobileHeaderAction = style({
  '@layer': {
    [app]: {
      inlineSize: 36,
      blockSize: 36,
      borderRadius: foundationVars.radius.sm,
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
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

export const previewDrawerBody = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      minBlockSize: 0
    }
  }
})
