import { style } from '@vanilla-extract/css'
import { foundationVars } from '../css/foundations.css.ts'
import { app } from '../css/layers.css.ts'

export const marketingRoot = style({
  '@layer': {
    [app]: {
      minHeight: '100dvh',
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary
    }
  }
})

export const marketingHeader = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[6],
      minHeight: '72px',
      padding: `0 ${foundationVars.space[12]}`,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.header
    }
  },
  '@media': {
    'screen and (max-width: 760px)': {
      padding: `0 ${foundationVars.space[5]}`,
      gap: foundationVars.space[3]
    }
  }
})

export const brandLink = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[3],
      color: foundationVars.color.text.primary,
      fontWeight: 700,
      textDecoration: 'none',
      whiteSpace: 'nowrap'
    }
  }
})

export const logoMark = style({
  '@layer': {
    [app]: {
      width: '32px',
      height: '32px',
      color: foundationVars.color.accent.solid
    }
  }
})

export const desktopNav = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flex: 1,
      gap: foundationVars.space[6]
    }
  },
  '@media': {
    'screen and (max-width: 760px)': {
      display: 'none'
    }
  }
})

export const headerActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[3]
    }
  },
  '@media': {
    'screen and (max-width: 760px)': {
      marginLeft: 'auto'
    }
  }
})

export const navLink = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.875rem',
      fontWeight: 500,
      textDecoration: 'none',
      transition: `color ${foundationVars.motion.fast} ease`
    }
  },
  'selectors': {
    '&:hover': {
      color: foundationVars.color.text.primary
    }
  }
})

export const primaryLink = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '40px',
      padding: `0 ${foundationVars.space[5]}`,
      border: `1px solid ${foundationVars.color.button.primary.border}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.button.primary.background,
      color: foundationVars.color.button.primary.text,
      fontSize: '0.875rem',
      fontWeight: 700,
      textDecoration: 'none',
      transition: `background-color ${foundationVars.motion.fast} ease`
    }
  },
  'selectors': {
    '&:hover': {
      backgroundColor: foundationVars.color.button.primary.hover
    }
  }
})

export const secondaryLink = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '40px',
      padding: `0 ${foundationVars.space[5]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.secondary,
      fontSize: '0.875rem',
      fontWeight: 700,
      textDecoration: 'none'
    }
  },
  'selectors': {
    '&:hover': {
      borderColor: foundationVars.color.border.strong,
      color: foundationVars.color.text.primary
    }
  }
})

export const mobileMenu = style({
  '@layer': {
    [app]: {
      display: 'none',
      position: 'relative'
    }
  },
  '@media': {
    'screen and (max-width: 760px)': {
      display: 'block'
    }
  }
})

export const mobileSummary = style({
  '@layer': {
    [app]: {
      cursor: 'pointer',
      listStyle: 'none',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      padding: `${foundationVars.space[2]} ${foundationVars.space[4]}`,
      color: foundationVars.color.text.primary,
      fontSize: '0.875rem',
      fontWeight: 700
    }
  }
})

export const mobileNavPanel = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      right: 0,
      top: 'calc(100% + 12px)',
      display: 'grid',
      gap: foundationVars.space[3],
      width: '240px',
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card
    }
  }
})

export const heroSection = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'justifyItems': 'center',
      'gap': foundationVars.space[5],
      'padding': `${foundationVars.space[13]} ${foundationVars.space[6]} ${foundationVars.space[10]}`,
      'textAlign': 'center',

      '@media': {
        'screen and (max-width: 760px)': {
          paddingTop: foundationVars.space[6]
        }
      }
    }
  }
})

export const eyebrow = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 'fit-content',
      padding: `${foundationVars.space[2]} ${foundationVars.space[4]}`,
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.accent.solid,
      fontSize: '0.75rem',
      fontWeight: 600
    }
  }
})

export const heroTitle = style({
  '@layer': {
    [app]: {
      maxWidth: '620px',
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: 'clamp(3rem, 7vw, 4rem)',
      fontWeight: 800,
      letterSpacing: '-0.045em',
      lineHeight: 1.08
    }
  }
})

export const heroCopy = style({
  '@layer': {
    [app]: {
      maxWidth: '520px',
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '1.25rem',
      lineHeight: 1.6
    }
  }
})

export const ctaRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: foundationVars.space[4]
    }
  }
})

export const heroMockup = style({
  '@layer': {
    [app]: {
      width: 'min(520px, calc(100vw - 32px))',
      minHeight: '620px',
      marginTop: foundationVars.space[4],
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xxl,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card
    }
  }
})

export const mockupTopbar = style({
  '@layer': {
    [app]: {
      minHeight: '64px',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.subtle
    }
  }
})

export const mockupBody = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '72px minmax(0, 1fr)',
      minHeight: '556px'
    }
  }
})

export const mockupRail = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      justifyItems: 'center',
      gap: foundationVars.space[4],
      paddingTop: foundationVars.space[8],
      borderRight: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.raised
    }
  }
})

export const railDot = style({
  '@layer': {
    [app]: {
      width: '10px',
      height: '10px',
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.text.muted
    }
  }
})

export const railDotActive = style({
  '@layer': {
    [app]: {
      width: '28px',
      height: '28px',
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.accent.soft,
      border: `1px solid ${foundationVars.color.accent.border}`
    }
  }
})

export const mockupContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5],
      alignContent: 'start',
      padding: foundationVars.space[8],
      textAlign: 'left'
    }
  }
})

export const mockupCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: foundationVars.space[5],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.raised
    }
  }
})

export const mockupSplit = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: foundationVars.space[4]
    }
  },
  '@media': {
    'screen and (max-width: 560px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const section = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'center',
      gap: foundationVars.space[8],
      padding: `6rem ${foundationVars.space[12]}`,
      backgroundColor: foundationVars.color.surface.raised,
      scrollMarginTop: '88px'
    }
  },
  '@media': {
    'screen and (max-width: 760px)': {
      padding: `${foundationVars.space[10]} ${foundationVars.space[5]}`
    }
  }
})

export const sectionAlt = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const sectionHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'center',
      gap: foundationVars.space[3],
      maxWidth: '840px',
      textAlign: 'center'
    }
  }
})

export const sectionLabel = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.accent.solid,
      fontSize: '0.6875rem',
      fontWeight: 700,
      letterSpacing: '0.18em',
      textTransform: 'uppercase'
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: 'clamp(2rem, 5vw, 2.5rem)',
      fontWeight: 800,
      letterSpacing: '-0.035em',
      lineHeight: 1.2
    }
  }
})

export const sectionCopy = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '1rem',
      lineHeight: 1.6
    }
  }
})

export const featureGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 544px))',
      gap: foundationVars.space[6],
      width: '100%',
      maxWidth: '1112px'
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const featureCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: foundationVars.space[6],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const featureIcon = style({
  '@layer': {
    [app]: {
      width: '44px',
      height: '44px',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.raised
    }
  }
})

export const pricingGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 320px))',
      gap: foundationVars.space[6],
      alignItems: 'stretch'
    }
  },
  '@media': {
    'screen and (max-width: 1100px)': {
      gridTemplateColumns: '1fr',
      width: '100%',
      maxWidth: '420px'
    }
  }
})

export const billingToggle = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      gap: foundationVars.space[2],
      padding: foundationVars.space[2],
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const billingActive = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[2]} ${foundationVars.space[4]}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.surface.raised,
      color: foundationVars.color.text.primary,
      fontSize: '0.8125rem',
      fontWeight: 600
    }
  }
})

export const billingMuted = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[2]} ${foundationVars.space[4]}`,
      color: foundationVars.color.text.muted,
      fontSize: '0.8125rem'
    }
  }
})

export const pricingCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto auto auto auto auto 1fr auto',
      gap: foundationVars.space[4],
      minHeight: '444px',
      padding: foundationVars.space[6],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xxl,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const pricingCta = style({
  '@layer': {
    [app]: {
      alignSelf: 'end',
      marginTop: 'auto'
    }
  }
})

export const pricingCardFeatured = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.border,
      boxShadow: foundationVars.shadow.focus
    }
  }
})

export const planBadge = style({
  '@layer': {
    [app]: {
      width: 'fit-content',
      padding: `0.2rem ${foundationVars.space[3]}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.primary,
      fontSize: '0.6875rem',
      fontWeight: 700
    }
  }
})

export const planName = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '0.875rem'
    }
  }
})

export const planPrice = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '2.75rem',
      fontWeight: 800,
      letterSpacing: '-0.04em',
      lineHeight: 1.15
    }
  }
})

export const planFeatureList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: `${foundationVars.space[4]} 0 0`,
      margin: `${foundationVars.space[3]} 0 0`,
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.secondary,
      fontSize: '0.875rem',
      listStyle: 'none'
    }
  }
})

export const finalCta = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'center',
      gap: foundationVars.space[5],
      padding: `6rem ${foundationVars.space[6]}`,
      textAlign: 'center',
      backgroundColor: foundationVars.color.surface.raised
    }
  }
})

export const marketingFooter = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-end',
      minHeight: '64px',
      padding: `0 ${foundationVars.space[12]}`,
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.header,
      color: foundationVars.color.text.muted,
      fontSize: '0.75rem'
    }
  },
  '@media': {
    'screen and (max-width: 760px)': {
      justifyContent: 'center',
      padding: `0 ${foundationVars.space[5]}`,
      textAlign: 'center'
    }
  }
})
