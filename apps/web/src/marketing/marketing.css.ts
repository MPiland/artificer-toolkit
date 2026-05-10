import { style } from '@vanilla-extract/css'
import { foundationVars } from '../css/foundations.css.ts'
import { app } from '../css/layers.css.ts'

export const marketingRoot = style({
  '@layer': {
    [app]: {
      height: '100dvh',
      overflowX: 'hidden',
      overflowY: 'auto',
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
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 0.9fr) minmax(460px, 1.1fr)',
      alignItems: 'center',
      gap: foundationVars.space[12],
      padding: `${foundationVars.space[14]} ${foundationVars.space[8]} ${foundationVars.space[12]}`,
      maxWidth: '1320px',
      margin: '0 auto'
    }
  },
  '@media': {
    'screen and (max-width: 1040px)': {
      gridTemplateColumns: '1fr',
      justifyItems: 'center',
      gap: foundationVars.space[7],
      padding: `${foundationVars.space[9]} ${foundationVars.space[6]} ${foundationVars.space[10]}`,
      textAlign: 'center'
    },
    'screen and (max-width: 760px)': {
      padding: `${foundationVars.space[6]} ${foundationVars.space[5]} ${foundationVars.space[9]}`
    }
  }
})

export const heroContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5],
      justifyItems: 'start',
      alignContent: 'center',
      maxWidth: '690px'
    }
  },
  '@media': {
    'screen and (max-width: 1040px)': {
      justifyItems: 'center'
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
      maxWidth: '760px',
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '4.5rem',
      fontWeight: 800,
      lineHeight: 1.02
    }
  },
  '@media': {
    'screen and (max-width: 1040px)': {
      maxWidth: '680px',
      fontSize: '3.75rem'
    },
    'screen and (max-width: 760px)': {
      fontSize: '2.75rem'
    }
  }
})

export const heroCopy = style({
  '@layer': {
    [app]: {
      maxWidth: '600px',
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '1.125rem',
      lineHeight: 1.7
    }
  }
})

export const ctaRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: foundationVars.space[4]
    }
  },
  '@media': {
    'screen and (max-width: 1040px)': {
      justifyContent: 'center'
    }
  }
})

export const heroHighlightGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: foundationVars.space[2],
      width: '100%',
      maxWidth: '660px',
      marginTop: foundationVars.space[3],
      paddingTop: foundationVars.space[4],
      borderTop: `1px solid ${foundationVars.color.border.subtle}`
    }
  },
  '@media': {
    'screen and (max-width: 1040px)': {
      maxWidth: '760px'
    },
    'screen and (max-width: 820px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const heroHighlightCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      borderRadius: foundationVars.radius.lg
    }
  }
})

export const heroHighlightLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.accent.solid,
      fontSize: '0.6875rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }
})

export const heroHighlightCopy = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.875rem',
      lineHeight: 1.55
    }
  }
})

export const heroMockup = style({
  '@layer': {
    [app]: {
      justifySelf: 'end',
      width: '100%',
      minHeight: '620px',
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xxl,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card,
      transform: 'rotate(0.7deg)'
    }
  },
  '@media': {
    'screen and (max-width: 1040px)': {
      width: 'min(680px, 100%)'
    }
  }
})

export const mockupTopbar = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'center',
      gap: foundationVars.space[4],
      minHeight: '72px',
      padding: `0 ${foundationVars.space[5]}`,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.subtle
    }
  }
})

export const mockupBody = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '88px minmax(0, 1fr)',
      minHeight: '568px'
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
      padding: `${foundationVars.space[6]} ${foundationVars.space[3]}`,
      borderRight: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.raised
    }
  }
})

export const mockupBrand = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[3],
      color: foundationVars.color.text.primary,
      fontSize: '0.875rem',
      fontWeight: 700
    }
  }
})

export const mockupBrandIcon = style({
  '@layer': {
    [app]: {
      width: '22px',
      height: '22px',
      color: foundationVars.color.accent.solid
    }
  }
})

export const mockupTopNav = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[3],
      justifySelf: 'center'
    }
  },
  '@media': {
    'screen and (max-width: 640px)': {
      display: 'none'
    }
  }
})

export const mockupTopNavItem = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.secondary,
      fontSize: '0.75rem',
      fontWeight: 600
    }
  }
})

export const mockupTopNavItemActive = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.primary
    }
  }
})

export const mockupTopStatus = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      justifySelf: 'end',
      color: foundationVars.color.text.secondary,
      fontSize: '0.75rem',
      fontWeight: 600
    }
  }
})

export const railDot = style({
  '@layer': {
    [app]: {
      width: '34px',
      height: '34px',
      padding: foundationVars.space[2],
      borderRadius: foundationVars.radius.lg,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.muted,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const railDotActive = style({
  '@layer': {
    [app]: {
      width: '42px',
      height: '42px',
      padding: foundationVars.space[2],
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.accent.soft,
      border: `1px solid ${foundationVars.color.accent.border}`,
      color: foundationVars.color.accent.solid
    }
  }
})

export const mockupContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5],
      alignContent: 'start',
      padding: `${foundationVars.space[6]} ${foundationVars.space[6]} ${foundationVars.space[8]}`,
      textAlign: 'left'
    }
  }
})

export const mockupKicker = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      width: 'fit-content',
      alignItems: 'center',
      gap: foundationVars.space[2],
      minHeight: '24px',
      padding: `0 ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.accent.solid,
      fontSize: '0.6875rem',
      fontWeight: 700,
      textTransform: 'uppercase'
    }
  }
})

export const mockupHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const mockupStage = style({
  '@layer': {
    [app]: {
      position: 'relative',
      minHeight: '420px',
      marginTop: foundationVars.space[3]
    }
  },
  '@media': {
    'screen and (max-width: 960px)': {
      display: 'grid',
      gap: foundationVars.space[4],
      minHeight: 'auto'
    }
  }
})

export const mockupSurface = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      display: 'grid',
      gap: foundationVars.space[3],
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card
    }
  },
  '@media': {
    'screen and (max-width: 960px)': {
      position: 'relative',
      inset: 'auto'
    }
  }
})

export const mockupSurfaceList = style({
  '@layer': {
    [app]: {
      top: foundationVars.space[4],
      left: 0,
      width: '36%',
      minHeight: '282px',
      zIndex: 1
    }
  },
  '@media': {
    'screen and (max-width: 960px)': {
      top: 'auto',
      left: 'auto',
      width: '100%',
      minHeight: 'auto'
    }
  }
})

export const mockupSurfaceEditor = style({
  '@layer': {
    [app]: {
      top: 0,
      right: 0,
      width: '66%',
      minHeight: '310px',
      zIndex: 2
    }
  },
  '@media': {
    'screen and (max-width: 960px)': {
      top: 'auto',
      right: 'auto',
      width: '100%',
      minHeight: 'auto'
    }
  }
})

export const mockupSurfaceSheet = style({
  '@layer': {
    [app]: {
      left: '16%',
      bottom: 0,
      width: '60%',
      minHeight: '188px',
      zIndex: 3
    }
  },
  '@media': {
    'screen and (max-width: 960px)': {
      left: 'auto',
      bottom: 'auto',
      width: '100%',
      minHeight: 'auto'
    }
  }
})

export const mockupSurfaceTop = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3]
    }
  }
})

export const mockupTraffic = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2]
    }
  }
})

export const mockupTrafficDot = style({
  '@layer': {
    [app]: {
      width: '8px',
      height: '8px',
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.border.strong
    }
  }
})

export const mockupSurfaceLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.6875rem',
      fontWeight: 700,
      textTransform: 'uppercase'
    }
  }
})

export const mockupListRows = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const mockupListRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      alignItems: 'center',
      gap: foundationVars.space[3],
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.raised
    }
  }
})

export const mockupListRowActive = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.accent.soft,
      border: `1px solid ${foundationVars.color.accent.border}`
    }
  }
})

export const mockupListTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.8125rem',
      fontWeight: 700
    }
  }
})

export const mockupListMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.6875rem',
      lineHeight: 1.45
    }
  }
})

export const mockupFieldGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: foundationVars.space[3]
    }
  },
  '@media': {
    'screen and (max-width: 560px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const mockupField = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const mockupFieldLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.6875rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      lineHeight: 1.3
    }
  }
})

export const mockupFieldValue = style({
  '@layer': {
    [app]: {
      minHeight: '38px',
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.raised,
      color: foundationVars.color.text.primary,
      fontSize: '0.8125rem'
    }
  }
})

export const mockupTextAreaValue = style([
  mockupFieldValue,
  {
    '@layer': {
      [app]: {
        minHeight: '84px'
      }
    }
  }
])

export const mockupSheetStats = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: foundationVars.space[3]
    }
  },
  '@media': {
    'screen and (max-width: 560px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
    }
  }
})

export const mockupStat = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      justifyItems: 'center',
      padding: foundationVars.space[3],
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.raised
    }
  }
})

export const mockupStatValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.25rem',
      fontWeight: 800,
      lineHeight: 1
    }
  }
})

export const mockupStatLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.6875rem',
      fontWeight: 700,
      textTransform: 'uppercase'
    }
  }
})

export const mockupPill = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      minHeight: '24px',
      minWidth: '66px',
      padding: `0 ${foundationVars.space[3]}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.surface.panel,
      color: foundationVars.color.text.secondary,
      fontSize: '0.6875rem',
      fontWeight: 700
    }
  }
})

export const section = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'center',
      gap: foundationVars.space[10],
      padding: `${foundationVars.space[14]} ${foundationVars.space[12]}`,
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
      justifyItems: 'start',
      gap: foundationVars.space[3],
      maxWidth: '840px',
      width: '100%',
      textAlign: 'left'
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      justifyItems: 'center',
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
      textTransform: 'uppercase'
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '2.5rem',
      fontWeight: 800,
      lineHeight: 1.2
    }
  },
  '@media': {
    'screen and (max-width: 760px)': {
      fontSize: '2rem'
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
      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      gap: foundationVars.space[5],
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
      gridColumn: 'span 6',
      gap: foundationVars.space[4],
      padding: foundationVars.space[6],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card,
      transition: `transform ${foundationVars.motion.base} ease, box-shadow ${foundationVars.motion.base} ease`
    }
  },
  'selectors': {
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: foundationVars.shadow.cardHover
    }
  }
})

export const featureCardWide = style({
  '@layer': {
    [app]: {
      gridColumn: 'span 7',
      minHeight: '340px'
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      gridColumn: 'auto'
    }
  }
})

export const featureCardNarrow = style({
  '@layer': {
    [app]: {
      gridColumn: 'span 5',
      minHeight: '300px'
    }
  },
  '@media': {
    'screen and (max-width: 900px)': {
      gridColumn: 'auto'
    }
  }
})

export const featureCardHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3]
    }
  }
})

export const featureIcon = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '48px',
      height: '48px',
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.accent.solid
    }
  }
})

export const featureAudience = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.75rem',
      fontWeight: 700,
      textTransform: 'uppercase'
    }
  }
})

export const featureTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '1.375rem',
      fontWeight: 800,
      lineHeight: 1.2
    }
  }
})

export const featureBody = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '0.9375rem',
      lineHeight: 1.65
    }
  }
})

export const featureBulletList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: `${foundationVars.space[4]} 0 0`,
      margin: 0,
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      listStyle: 'none'
    }
  }
})

export const featureBullet = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      alignItems: 'start',
      gap: foundationVars.space[3],
      color: foundationVars.color.text.secondary,
      fontSize: '0.875rem',
      lineHeight: 1.55
    }
  }
})

export const featureBulletMarker = style({
  '@layer': {
    [app]: {
      width: '8px',
      height: '8px',
      marginTop: '0.45rem',
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.accent.solid
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
      padding: `${foundationVars.space[14]} ${foundationVars.space[6]}`,
      textAlign: 'center',
      backgroundColor: foundationVars.color.surface.raised
    }
  }
})

export const finalCtaPanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'center',
      gap: foundationVars.space[5],
      width: 'min(920px, 100%)',
      padding: `${foundationVars.space[12]} ${foundationVars.space[8]}`,
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.xxl,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card
    }
  },
  '@media': {
    'screen and (max-width: 760px)': {
      padding: `${foundationVars.space[8]} ${foundationVars.space[5]}`
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
