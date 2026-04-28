import { keyframes, style } from '@vanilla-extract/css'
import { foundationVars } from '../css/foundations.css.ts'
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
      color: foundationVars.color.text.primary
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const authRootSupport = style({
  '@layer': {
    [app]: {
      gridTemplateColumns: 'minmax(420px, 1fr) minmax(420px, 1fr)'
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const authHeroPanel = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'grid',
      gridTemplateRows: 'auto 1fr',
      minHeight: '100dvh',
      overflow: 'hidden',
      padding: `clamp(${foundationVars.space[8]}, 5vw, ${foundationVars.space[13]})`,
      backgroundColor: foundationVars.color.surface.header,
      borderRight: `1px solid ${foundationVars.color.border.subtle}`
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      minHeight: 'auto',
      gap: foundationVars.space[6],
      padding: `${foundationVars.space[8]} ${foundationVars.space[6]}`,
      borderRight: 0,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`
    },
    'screen and (max-width: 600px)': {
      padding: `${foundationVars.space[6]} ${foundationVars.space[5]}`
    }
  }
})

export const authHeroPanelSupport = style({
  '@layer': {
    [app]: {
      alignContent: 'stretch'
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      paddingBottom: foundationVars.space[5]
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
      borderBottom: `1px solid ${foundationVars.color.border.strong}`
    }
  },
  '@media': {
    'screen and (max-width: 600px)': {
      gap: foundationVars.space[3]
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
      display: 'grid',
      alignContent: 'center',
      justifyItems: 'start',
      gap: foundationVars.space[4],
      justifySelf: 'center',
      width: '100%',
      maxWidth: '560px',
      textAlign: 'left',
      transform: 'translateY(2vh)'
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      justifyItems: 'center',
      maxWidth: '520px',
      textAlign: 'center',
      transform: 'none'
    }
  }
})

export const authHeroTitle = style({
  '@layer': {
    [app]: {
      maxWidth: '560px',
      margin: `0 0 ${foundationVars.space[6]}`,
      color: foundationVars.color.text.primary,
      fontSize: '3.25rem',
      fontWeight: foundationVars.fontWeight.heavy,
      letterSpacing: '-0.032em',
      lineHeight: 1.06
    }
  },
  '@media': {
    'screen and (max-width: 1100px)': {
      fontSize: '2.75rem'
    },
    'screen and (max-width: 900px)': {
      maxWidth: '680px',
      fontSize: '2.25rem',
      letterSpacing: '-0.025em'
    },
    'screen and (max-width: 600px)': {
      fontSize: foundationVars.typography.title.fontSize,
      lineHeight: foundationVars.typography.title.lineHeight,
      marginBottom: foundationVars.space[4]
    }
  }
})

export const authHeroTitleSupport = style({
  '@layer': {
    [app]: {
      maxWidth: '520px'
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      fontSize: foundationVars.typography.heading.fontSize
    },
    'screen and (max-width: 600px)': {
      fontSize: foundationVars.typography.heading.fontSize
    }
  }
})

export const authHeroSubtitle = style({
  '@layer': {
    [app]: {
      maxWidth: '42ch',
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '1.125rem',
      lineHeight: 1.62
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      fontSize: foundationVars.typography.body.fontSize
    }
  }
})

export const authPanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      placeItems: 'center',
      minHeight: '100dvh',
      padding: `clamp(${foundationVars.space[8]}, 5vw, ${foundationVars.space[13]}) ${foundationVars.space[8]}`
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      minHeight: 'auto',
      padding: `${foundationVars.space[6]} ${foundationVars.space[5]} ${foundationVars.space[10]}`
    },
    'screen and (max-width: 600px)': {
      padding: `${foundationVars.space[5]} ${foundationVars.space[5]} ${foundationVars.space[8]}`
    }
  }
})

export const authPanelSupport = style({
  '@layer': {
    [app]: {
      placeItems: 'center'
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      placeItems: 'center'
    }
  }
})

export const authCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5],
      width: 'min(460px, 100%)',
      padding: foundationVars.space[8],
      border: `1px solid ${foundationVars.color.card.border.default}`,
      borderRadius: foundationVars.radius.xl,
      backgroundColor: foundationVars.color.card.background.default,
      boxShadow: foundationVars.shadow.card,
      animation: `${authPanelEnter} 260ms cubic-bezier(0.16, 1, 0.3, 1)`
    }
  },
  '@media': {
    'screen and (max-width: 600px)': {
      padding: foundationVars.space[6]
    },
    '(prefers-reduced-motion: reduce)': {
      animation: 'none'
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

export const authFieldHint = style({
  '@layer': {
    [app]: {
      margin: `-${foundationVars.space[2]} 0 0`,
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight
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
  'selectors': {
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
