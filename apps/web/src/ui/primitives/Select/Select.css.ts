import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const root = style({
  '@layer': {
    [app]: {
      width: '100%'
    }
  }
})

export const label = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.label.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.label.lineHeight
    }
  }
})

export const description = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const required = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.input.border.error
    }
  }
})

export const input = style({
  '@layer': {
    [app]: {
      vars: {
        '--input-bg': foundationVars.color.input.background.default,
        '--input-bd': foundationVars.color.input.border.default,
        '--input-color': foundationVars.color.text.primary,
        '--input-placeholder-color': foundationVars.color.input.placeholder
      },
      backgroundColor: `${foundationVars.color.input.background.default}`,
      borderColor: foundationVars.color.input.border.default,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.primary,
      minHeight: '40px',
      transition: `border-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease, background ${foundationVars.motion.fast} ease`,
      '@media': {
        '(max-width: 760px)': {
          fontSize: '1rem'
        }
      },

      selectors: {
        '&:hover:not(:disabled)': {
          vars: {
            '--input-bg': foundationVars.color.input.background.hover,
            '--input-bd': foundationVars.color.border.strong
          },
          backgroundColor: `${foundationVars.color.input.background.hover}`,
          borderColor: foundationVars.color.border.strong
        },
        '&:focus, &:focus-within': {
          vars: {
            '--input-bd': foundationVars.color.input.border.focus
          },
          borderColor: foundationVars.color.input.border.focus,
          boxShadow: foundationVars.shadow.focus
        },
        '&[data-placeholder]': {
          color: foundationVars.color.input.placeholder
        },
        '&::placeholder': {
          color: foundationVars.color.input.placeholder,
          opacity: 1
        },
        '&:disabled, &[data-disabled="true"], &[readonly], &[data-readonly="true"]': {
          vars: {
            '--input-bg': foundationVars.color.input.background.disabled,
            '--input-bd': foundationVars.color.input.border.disabled,
            '--input-color': foundationVars.color.text.secondary
          },
          backgroundColor: `${foundationVars.color.input.background.disabled}`,
          borderColor: foundationVars.color.input.border.disabled,
          color: foundationVars.color.text.secondary
        }
      }
    }
  }
})

export const multiSelectInput = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center'
    }
  }
})

export const pillsList = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'nowrap',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minHeight: '28px',
      minWidth: 0,
      width: '100%',
      overflow: 'hidden'
    }
  }
})

export const inputField = style({
  '@layer': {
    [app]: {
      alignSelf: 'center',
      flex: '0 0 2ch',
      minWidth: '2ch'
    }
  }
})

export const dropdown = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      borderColor: foundationVars.color.border.subtle,
      borderRadius: foundationVars.radius.lg,
      boxShadow: foundationVars.shadow.card,
      padding: foundationVars.space[2]
    }
  }
})

export const option = style({
  '@layer': {
    [app]: {
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.primary,

      selectors: {
        '&[data-combobox-selected]': {
          background: foundationVars.color.accent.soft,
          color: foundationVars.color.text.primary
        },
        '&[data-combobox-active]': {
          background: foundationVars.color.card.background.hover
        }
      }
    }
  }
})

export const pill = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      flex: '0 1 auto',
      minHeight: '24px',
      maxWidth: 'min(11rem, 45%)',
      minWidth: 0,
      background: foundationVars.color.accent.soft,
      border: `1px solid ${foundationVars.color.accent.border}`,
      color: foundationVars.color.text.primary,
      lineHeight: '22px'
    }
  }
})

export const pillLabel = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minWidth: 0,
      lineHeight: '20px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const pillRemove = style({
  '@layer': {
    [app]: {
      alignSelf: 'center',
      '@media': {
        '(max-width: 760px)': {
          minWidth: '44px',
          minHeight: '44px'
        }
      }
    }
  }
})
