import { style } from '@vanilla-extract/css'
import { foundationVars } from '../css/foundations.css.ts'
import { app } from '../css/layers.css.ts'

export const authRoot = style({
  '@layer': {
    [app]: {
      minHeight: '100dvh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
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

export const authHeroPanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto 1fr',
      minHeight: '100dvh',
      padding: '80px',
      backgroundColor: foundationVars.color.surface.header
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      minHeight: 'auto',
      gap: foundationVars.space[8],
      padding: `${foundationVars.space[8]} ${foundationVars.space[6]}`
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
      paddingBottom: foundationVars.space[3],
      borderBottom: `1px solid ${foundationVars.color.border.strong}`
    }
  },
  '@media': {
    'screen and (max-width: 600px)': {
      alignItems: 'start',
      flexDirection: 'column'
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
      justifyItems: 'center',
      gap: foundationVars.space[8],
      justifySelf: 'center',
      width: '100%',
      maxWidth: '560px',
      textAlign: 'center'
    }
  }
})

export const authHeroTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.display.fontSize,
      fontWeight: foundationVars.typography.display.fontWeight,
      letterSpacing: foundationVars.typography.display.letterSpacing,
      lineHeight: foundationVars.typography.display.lineHeight
    }
  }
})

export const authHeroSubtitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.body.fontSize,
      lineHeight: foundationVars.typography.body.lineHeight
    }
  }
})

export const authBulletList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      justifySelf: 'center',
      width: 'fit-content',
      padding: 0,
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '0.875rem',
      listStyle: 'none',
      textAlign: 'left'
    }
  }
})

export const authPanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      placeItems: 'center',
      minHeight: '100dvh',
      padding: '80px'
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      minHeight: 'auto',
      padding: `${foundationVars.space[6]} ${foundationVars.space[5]} ${foundationVars.space[10]}`
    }
  }
})

export const authCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      width: 'min(440px, 100%)',
      padding: foundationVars.space[8],
      border: `1px solid ${foundationVars.color.card.border.default}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.card.background.default,
      boxShadow: foundationVars.shadow.card
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
        }
      }
    }
  }
})

export const inlineLinkIcon = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      color: foundationVars.color.text.accent
    }
  }
})

export const authButton = style({
  '@layer': {
    [app]: {
      justifySelf: 'start',
      minHeight: '40px',
      padding: `0 ${foundationVars.space[4]}`,
      border: `1px solid ${foundationVars.color.button.primary.border}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.button.primary.background,
      color: foundationVars.color.button.primary.text,
      cursor: 'pointer',
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.medium,

      selectors: {
        '&:disabled': {
          cursor: 'not-allowed',
          opacity: 0.62
        },
        '&:hover:not(:disabled)': {
          backgroundColor: foundationVars.color.button.primary.hover
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
