import { assignVars, style } from '@vanilla-extract/css'
import { foundationVars, lightFoundationTokens } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

export const authRoot = style({
  '@layer': {
    [app]: {
      vars: assignVars(foundationVars.color, lightFoundationTokens.color),
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
      alignContent: 'space-between',
      minHeight: '100dvh',
      padding: '80px',
      backgroundColor: foundationVars.color.surface.raised
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

export const authBrand = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[3],
      width: 'fit-content',
      padding: `0 ${foundationVars.space[4]} ${foundationVars.space[3]}`,
      borderBottom: `1px solid ${foundationVars.color.border.strong}`,
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
      color: foundationVars.color.accent.solid
    }
  }
})

export const authHeroCopy = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[8],
      maxWidth: '560px'
    }
  }
})

export const authHeroTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: 'clamp(3rem, 7vw, 4rem)',
      fontWeight: 800,
      letterSpacing: '-0.045em',
      lineHeight: 1.12
    }
  }
})

export const authHeroSubtitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '1rem',
      lineHeight: 1.45
    }
  }
})

export const authBulletList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      padding: 0,
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '0.875rem',
      listStyle: 'none'
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
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.raised
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
      fontSize: '1.5rem',
      fontWeight: 800,
      lineHeight: 1.2
    }
  }
})

export const authDescription = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '0.875rem',
      lineHeight: 1.4
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
      fontSize: '0.6875rem',
      fontWeight: 700,
      lineHeight: 1.45
    }
  }
})

export const textInput = style({
  '@layer': {
    [app]: {
      width: '100%',
      minHeight: '40px',
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary,
      font: 'inherit',
      fontSize: '0.875rem',
      outline: 'none',
      transition: `border-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease`
    }
  },
  selectors: {
    '&:focus': {
      borderColor: foundationVars.color.accent.border,
      boxShadow: foundationVars.shadow.focus
    },
    '&::placeholder': {
      color: foundationVars.color.text.muted
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
      color: foundationVars.color.accent.solid,
      fontSize: '0.8125rem',
      textDecoration: 'none'
    }
  },
  selectors: {
    '&:hover': {
      color: foundationVars.color.accent.hover,
      textDecoration: 'underline'
    }
  }
})

export const authButton = style({
  '@layer': {
    [app]: {
      justifySelf: 'start',
      minHeight: '40px',
      padding: `0 ${foundationVars.space[4]}`,
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.accent.solid,
      color: foundationVars.color.accent.contrast,
      cursor: 'pointer',
      font: 'inherit',
      fontSize: '0.875rem',
      fontWeight: 700
    }
  },
  selectors: {
    '&:disabled': {
      cursor: 'not-allowed',
      opacity: 0.62
    },
    '&:hover:not(:disabled)': {
      backgroundColor: foundationVars.color.accent.hover
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
      fontSize: '0.8125rem'
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
      fontSize: '0.8125rem'
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
