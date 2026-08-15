import { keyframes, style } from '@vanilla-extract/css'
import { foundationVars, media } from '../css/foundations.css.ts'
import { app } from '../css/layers.css.ts'

const authPanelEnter = keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(10px)'
  },
  to: {
    opacity: 1,
    transform: 'translateY(0)'
  }
})

export const authRoot = style({
  '@layer': {
    [app]: {
      minHeight: '100dvh',
      display: 'grid',
      gridTemplateColumns: 'minmax(420px, 1fr) minmax(420px, 1fr)',
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary,
      '@media': {
        [media.tablet]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const authHeroPanel = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      padding: `clamp(${foundationVars.space[8]}, 5vw, ${foundationVars.space[13]})`,
      backgroundColor: foundationVars.color.surface.header,
      borderRight: `1px solid ${foundationVars.color.border.subtle}`,
      '@media': {
        [media.tablet]: {
          display: 'none'
        }
      }
    }
  }
})

export const authHeroHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      width: '100%',
      paddingBottom: foundationVars.space[4],
      borderBottom: `1px solid ${foundationVars.color.border.strong}`,
      '@media': {
        [media.mobile]: {
          gap: foundationVars.space[3]
        }
      }
    }
  }
})

export const authBrand = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[3],
      width: 'fit-content',
      padding: 0,
      color: foundationVars.color.text.primary,
      fontWeight: 700,
      textDecoration: 'none'
    }
  }
})

export const authLogo = style({
  '@layer': {
    [app]: {
      width: '36px',
      height: '36px',
      color: foundationVars.color.logo.icon
    }
  }
})

export const authHeroCopy = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      minBlockSize: 0,
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: foundationVars.space[4],
      inlineSize: 'min(100%, 560px)',
      marginInline: 'auto'
    }
  }
})

export const authHeroTitle = style({
  '@layer': {
    [app]: {
      inlineSize: '100%',
      margin: `0 0 ${foundationVars.space[6]}`,
      color: foundationVars.color.text.primary,
      fontSize: '3.25rem',
      fontWeight: foundationVars.fontWeight.heavy,
      letterSpacing: '-0.032em',
      lineHeight: 1.06,
      '@media': {
        'screen and (max-width: 1100px)': {
          fontSize: '2.75rem'
        }
      }
    }
  }
})

export const authHeroSubtitle = style({
  '@layer': {
    [app]: {
      inlineSize: '100%',
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '1.125rem',
      lineHeight: 1.62,
      '@media': {
        [media.tablet]: {
          fontSize: foundationVars.typography.body.fontSize
        }
      }
    }
  }
})

export const authPanel = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      placeItems: 'center',
      padding: `clamp(${foundationVars.space[8]}, 5vw, ${foundationVars.space[13]}) ${foundationVars.space[8]}`,
      '@media': {
        [media.tablet]: {
          minBlockSize: 'auto',
          padding: `${foundationVars.space[6]} ${foundationVars.space[5]} ${foundationVars.space[10]}`
        },
        [media.mobile]: {
          padding: `${foundationVars.space[5]} ${foundationVars.space[5]} ${foundationVars.space[8]}`
        }
      }
    }
  }
})

export const authBackLink = style({
  '@layer': {
    [app]: {
      display: 'none',
      '@media': {
        [media.tablet]: {
          display: 'flex',
          flexDirection: 'row',
          gap: foundationVars.space[2],
          justifyContent: 'start',
          blockSize: 'fit-content',
          inlineSize: '100%',
          textDecoration: 'none',
          color: foundationVars.color.accent.tertiaryBorder
        }
      }
    }
  }
})

export const authCard = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      blockSize: '100%',
      justifyContent: 'center',
      inlineSize: 'min(360px, 100%)',
      gap: foundationVars.space[5],
      padding: foundationVars.space[8],
      boxShadow: foundationVars.shadow.card,
      animation: `${authPanelEnter} 260ms cubic-bezier(0.16, 1, 0.3, 1)`,
      '@media': {
        [media.mobile]: {
          padding: foundationVars.space[6]
        },
        '(prefers-reduced-motion: reduce)': {
          animation: 'none'
        }
      }
    }
  }
})

export const authCardHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const authTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.heading.fontSize,
      fontWeight: foundationVars.typography.heading.fontWeight,
      letterSpacing: foundationVars.typography.heading.letterSpacing,
      lineHeight: foundationVars.typography.heading.lineHeight
    }
  }
})

export const authDescription = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const authForm = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4]
    }
  }
})

export const authFormMessage = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.raised,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const authFormMessageError = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.status.danger,
      backgroundColor: foundationVars.color.status.dangerSoft,
      color: foundationVars.color.text.primary
    }
  }
})

export const authFormMessageSuccess = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.status.success,
      backgroundColor: foundationVars.color.status.successSoft,
      color: foundationVars.color.text.primary
    }
  }
})

export const fieldGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const fieldLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.label.fontSize,
      fontWeight: foundationVars.typography.label.fontWeight,
      letterSpacing: foundationVars.typography.label.letterSpacing,
      lineHeight: foundationVars.typography.label.lineHeight
    }
  }
})

export const fieldHint = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const verificationCodeGroup = style({
  '@layer': {
    [app]: {
      justifyContent: 'center',
      inlineSize: '100%'
    }
  }
})

export const verificationCodeDigit = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.input.border.default,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.medium
    }
  }
})

export const passwordMatchFeedback = style({
  '@layer': {
    [app]: {
      marginTop: `-${foundationVars.space[2]}`,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const passwordMatchFeedbackSuccess = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.success
    }
  }
})

export const passwordMatchFeedbackError = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.danger
    }
  }
})

export const textInput = style({
  '@layer': {
    [app]: {
      width: '100%',
      minHeight: '40px',
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.input.border.default}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.primary,
      font: 'inherit',
      fontSize: foundationVars.typography.bodySm.fontSize,
      outline: 'none',
      transition: `border-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease`
    }
  },
  selectors: {
    '&:focus': {
      borderColor: foundationVars.color.input.border.focus,
      boxShadow: foundationVars.shadow.focus
    },
    '&::placeholder': {
      color: foundationVars.color.input.placeholder
    }
  }
})

export const forgotRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }
})

export const inlineLink = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent,
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight,
      backgroundColor: 'transparent',
      textDecoration: 'none',

      selectors: {
        '&:hover': {
          color: foundationVars.color.icon.hover,
          textDecoration: 'none'
        },
        '&:focus-visible': {
          borderRadius: foundationVars.radius.sm,
          outline: `2px solid ${foundationVars.color.accent.solid}`,
          outlineOffset: '3px'
        }
      }
    }
  }
})

export const inlineLinkIcon = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: foundationVars.color.text.accent,
      lineHeight: 1
    }
  }
})

export const inlineLinkIconGlyph = style({
  '@layer': {
    [app]: {
      display: 'block',
      flexShrink: 0
    }
  }
})

export const authButton = style({
  '@layer': {
    [app]: {
      justifySelf: 'stretch',
      minHeight: '44px',
      padding: `0 ${foundationVars.space[4]}`,
      border: `1px solid ${foundationVars.color.button.primary.border}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.button.primary.background,
      color: foundationVars.color.button.primary.text,
      cursor: 'pointer',
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      transition: `background-color ${foundationVars.motion.fast} ease, transform ${foundationVars.motion.fast} ease`,

      selectors: {
        '&:disabled': {
          cursor: 'not-allowed',
          opacity: 0.62
        },
        '&:hover:not(:disabled)': {
          backgroundColor: foundationVars.color.button.primary.hover,
          transform: 'translateY(-1px)'
        },
        '&:active:not(:disabled)': {
          transform: 'translateY(0)'
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus
        }
      }
    }
  }
})

export const authDivider = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: foundationVars.space[3],
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.caption.fontSize
    }
  }
})

export const authDividerLine = style({
  '@layer': {
    [app]: {
      height: '1px',
      backgroundColor: foundationVars.color.border.strong
    }
  }
})

export const authFooterRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'center',
      gap: foundationVars.space[2],
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize
    }
  }
})

export const transitionContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      justifyItems: 'start',
      color: foundationVars.color.text.secondary
    }
  }
})
