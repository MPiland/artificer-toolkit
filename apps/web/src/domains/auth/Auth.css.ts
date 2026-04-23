import { globalStyle, keyframes, style } from '@vanilla-extract/css'
import { app } from '#css/layers.css'
import { foundationVars } from '#css/foundations.css'

const fadeUp = keyframes({
  from: { opacity: 0, transform: 'translateY(14px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
})

export const authRoot = style({
  '@layer': {
    [app]: {
      minHeight: '100dvh',
      padding: '16px',
      display: 'flex',
      alignItems: 'stretch',
      justifyContent: 'center',
      background: `
        radial-gradient(circle at top left, ${foundationVars.color.decorative.heroStart}, transparent 32%),
        linear-gradient(180deg, ${foundationVars.color.surface.canvas} 0%, ${foundationVars.color.surface.subtle} 100%)
      `,
      '@media': {
        '(min-width: 768px)': {
          padding: '24px',
        },
      },
    },
  },
})

export const authStage = style({
  '@layer': {
    [app]: {
      width: '100%',
      maxWidth: foundationVars.size.authStageMax,
      minHeight: 'calc(100dvh - 32px)',
      display: 'grid',
      gridTemplateColumns: '1fr',
      overflow: 'hidden',
      borderRadius: foundationVars.radius.xl,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.raised,
      boxShadow: foundationVars.shadow.card,
      '@media': {
        '(min-width: 960px)': {
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(420px, 0.9fr)',
          minHeight: 'min(760px, calc(100dvh - 48px))',
        },
      },
    },
  },
})

export const authHero = style({
  '@layer': {
    [app]: {
      display: 'none',
      '@media': {
        '(min-width: 960px)': {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px',
          background: `
            linear-gradient(160deg, ${foundationVars.color.decorative.heroStart} 0%, transparent 58%),
            linear-gradient(180deg, ${foundationVars.color.surface.raised} 0%, ${foundationVars.color.surface.subtle} 100%)
          `,
        },
      },
    },
  },
})

export const authHeroBrand = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[4],
    },
  },
})

export const authBrandMark = style({
  '@layer': {
    [app]: {
      flex: 'none',
      width: '22px',
      height: '22px',
      color: foundationVars.color.accent.solid,
    },
  },
})

export const authBrandBlock = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px',
    },
  },
})

export const authBrandEyebrow = style({
  '@layer': {
    [app]: {
      fontFamily: foundationVars.font.sans,
      fontSize: '0.72rem',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: foundationVars.color.text.muted,
    },
  },
})

export const authBrandName = style({
  '@layer': {
    [app]: {
      fontFamily: foundationVars.font.display,
      fontSize: '1rem',
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
      fontWeight: 650,
      color: foundationVars.color.text.primary,
    },
  },
})

export const authHeroKicker = style({
  '@layer': {
    [app]: {
      marginTop: 'auto',
      marginBottom: foundationVars.space[4],
      fontSize: '0.82rem',
      lineHeight: 1.4,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: foundationVars.color.accent.solid,
    },
  },
})

export const authHeroTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      maxWidth: foundationVars.size.contentMeasure,
      fontFamily: foundationVars.font.display,
      fontSize: 'clamp(2.6rem, 4vw, 4rem)',
      lineHeight: 0.98,
      letterSpacing: '-0.05em',
      fontWeight: 650,
      color: foundationVars.color.text.primary,
      textWrap: 'balance',
    },
  },
})

export const authHeroCopy = style({
  '@layer': {
    [app]: {
      margin: `${foundationVars.space[5]} 0 0`,
      maxWidth: '30rem',
      fontSize: '1rem',
      lineHeight: 1.65,
      color: foundationVars.color.text.secondary,
    },
  },
})

export const authHeroList = style({
  '@layer': {
    [app]: {
      margin: `${foundationVars.space[8]} 0 0`,
      padding: 0,
      listStyle: 'none',
      display: 'grid',
      gap: foundationVars.space[4],
    },
  },
})

export const authHeroItem = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '12px 1fr',
      gap: foundationVars.space[3],
      alignItems: 'start',
      color: foundationVars.color.text.secondary,
      lineHeight: 1.55,
      selectors: {
        '&::before': {
          content: '""',
          width: '8px',
          height: '8px',
          marginTop: '0.45rem',
          borderRadius: '50%',
          backgroundColor: foundationVars.color.accent.solid,
          boxShadow: `0 0 0 6px ${foundationVars.color.accent.soft}`,
        },
      },
    },
  },
})

export const authPanel = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'stretch',
      justifyContent: 'center',
      minHeight: 'calc(100dvh - 32px)',
      '@media': {
        '(min-width: 960px)': {
          minHeight: '100%',
        },
      },
    },
  },
})

export const authCard = style({
  '@layer': {
    [app]: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '32px 24px',
      backgroundColor: foundationVars.color.surface.panel,
      animation: `${fadeUp} ${foundationVars.motion.slow} ease both`,
      '@media': {
        '(min-width: 640px)': {
          padding: '40px',
        },
        '(min-width: 960px)': {
          maxWidth: foundationVars.size.authPanelMax,
          padding: '48px',
        },
      },
    },
  },
})

export const authHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5],
      marginBottom: foundationVars.space[8],
    },
  },
})

export const authTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      fontFamily: foundationVars.font.display,
      fontSize: 'clamp(2rem, 2.4vw, 2.6rem)',
      lineHeight: 1,
      letterSpacing: '-0.05em',
      fontWeight: 650,
      color: foundationVars.color.text.primary,
      textWrap: 'balance',
    },
  },
})

export const authSubtitle = style({
  '@layer': {
    [app]: {
      fontSize: '0.98rem',
      lineHeight: 1.6,
      color: foundationVars.color.text.secondary,
      textWrap: 'pretty',
    },
  },
})

export const authForm = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5],
    },
  },
})

export const authLink = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.accent.solid,
      fontWeight: 600,
      textDecoration: 'none',
      transition: `color ${foundationVars.motion.fast} ease`,
      ':hover': {
        color: foundationVars.color.accent.hover,
      },
    },
  },
})

export const authForgotRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: `calc(${foundationVars.space[3]} * -1)`,
    },
  },
})

export const authForgotLink = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.92rem',
      lineHeight: 1.4,
      textDecoration: 'none',
      transition: `color ${foundationVars.motion.fast} ease`,
      ':hover': {
        color: foundationVars.color.accent.solid,
      },
    },
  },
})

export const authFieldInput = style({
  '@layer': {
    [app]: {
      minHeight: '52px',
      borderColor: foundationVars.color.border.strong,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.raised,
      color: foundationVars.color.text.primary,
      fontSize: '0.98rem',
      transition: `border-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease`,
      selectors: {
        '&::placeholder': {
          color: foundationVars.color.text.muted,
        },
        '&:focus, &:focus-within': {
          borderColor: foundationVars.color.accent.border,
          boxShadow: foundationVars.shadow.focus,
        },
      },
    },
  },
})

export const authFieldLabel = style({
  '@layer': {
    [app]: {
      marginBottom: foundationVars.space[2],
      fontSize: '0.86rem',
      lineHeight: 1.3,
      fontWeight: 600,
      color: foundationVars.color.text.secondary,
    },
  },
})

export const authFieldError = style({
  '@layer': {
    [app]: {
      marginTop: foundationVars.space[2],
      fontSize: '0.84rem',
      lineHeight: 1.45,
      color: foundationVars.color.status.danger,
    },
  },
})

export const authHint = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`,
      borderRadius: foundationVars.radius.md,
      fontSize: '0.92rem',
      lineHeight: 1.55,
      border: '1px solid transparent',
    },
  },
})

export const authHintError = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.danger,
      backgroundColor: foundationVars.color.status.dangerSoft,
      borderColor: foundationVars.color.status.danger,
    },
  },
})

export const authHintInfo = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.accent.solid,
      backgroundColor: foundationVars.color.accent.soft,
      borderColor: foundationVars.color.accent.border,
    },
  },
})

export const submitButton = style({
  '@layer': {
    [app]: {
      minHeight: '52px',
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.accent.solid,
      color: foundationVars.color.accent.contrast,
      fontFamily: foundationVars.font.sans,
      fontSize: '0.98rem',
      fontWeight: 650,
      letterSpacing: '-0.01em',
      transition: `transform ${foundationVars.motion.fast} ease, background-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease`,
      ':hover': {
        backgroundColor: foundationVars.color.accent.hover,
        boxShadow: foundationVars.shadow.cardHover,
      },
      ':active': {
        transform: 'translateY(1px)',
      },
      ':disabled': {
        opacity: 0.72,
        transform: 'none',
      },
    },
  },
})

export const confirmedIcon = style({
  '@layer': {
    [app]: {
      width: '64px',
      height: '64px',
      display: 'grid',
      placeItems: 'center',
      borderRadius: '50%',
      backgroundColor: foundationVars.color.status.successSoft,
      color: foundationVars.color.status.success,
      border: `1px solid ${foundationVars.color.accent.border}`,
    },
  },
})

export const confirmedTitle = style({
  '@layer': {
    [app]: {
      fontFamily: foundationVars.font.display,
      fontSize: 'clamp(2rem, 2.4vw, 2.5rem)',
      lineHeight: 1,
      letterSpacing: '-0.05em',
      fontWeight: 650,
      color: foundationVars.color.text.primary,
    },
  },
})

export const confirmedSubtext = style({
  '@layer': {
    [app]: {
      maxWidth: '24rem',
      fontSize: '0.98rem',
      lineHeight: 1.6,
      color: foundationVars.color.text.secondary,
    },
  },
})

globalStyle(`${authPanel} .mantine-Input-input`, {
  '@layer': {
    [app]: {
      borderRadius: foundationVars.radius.md,
    },
  },
})
