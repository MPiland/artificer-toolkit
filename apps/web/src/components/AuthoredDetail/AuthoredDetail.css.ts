import { globalStyle, style, styleVariants } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

const narrow = 'screen and (max-width: 900px)'
const mobile = 'screen and (max-width: 640px)'

export const storyCanvas = style({
  '@layer': {
    [app]: {
      minHeight: '100dvh',
      padding: `${foundationVars.space[8]} ${foundationVars.space[6]}`,
      backgroundColor: foundationVars.color.surface.canvas
    }
  },
  '@media': {
    [mobile]: {
      padding: foundationVars.space[4]
    }
  }
})

export const layout = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[6],
      width: '100%',
      maxWidth: '1180px',
      marginInline: 'auto',
      color: foundationVars.color.text.primary
    }
  }
})

export const hero = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 360px)',
      gap: foundationVars.space[6],
      alignItems: 'end',
      padding: `${foundationVars.space[8]} ${foundationVars.space[8]} ${foundationVars.space[6]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xxl,
      background: `linear-gradient(145deg, ${foundationVars.color.surface.panel} 0%, ${foundationVars.color.surface.raised} 58%, ${foundationVars.color.surface.subtle} 100%)`,
      boxShadow: foundationVars.shadow.card
    }
  },
  '@media': {
    [narrow]: {
      gridTemplateColumns: '1fr',
      padding: foundationVars.space[5]
    }
  }
})

export const heroMain = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      minWidth: 0
    }
  }
})

export const eyebrow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent,
      fontFamily: foundationVars.font.mono,
      fontSize: '0.72rem',
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      margin: 0,
      maxWidth: '13ch',
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.display,
      fontSize: 'clamp(2.35rem, 6vw, 4.85rem)',
      fontWeight: foundationVars.fontWeight.heavy,
      letterSpacing: '-0.045em',
      lineHeight: 0.94
    }
  }
})

export const summary = style({
  '@layer': {
    [app]: {
      maxWidth: '68ch',
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.body.fontSize,
      lineHeight: '1.65'
    }
  }
})

export const actionBar = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2],
      alignItems: 'center',
      justifyContent: 'flex-end'
    }
  },
  '@media': {
    [narrow]: {
      justifyContent: 'flex-start'
    }
  }
})

export const metaRail = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      alignSelf: 'stretch'
    }
  }
})

export const statusRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2],
      justifyContent: 'flex-end'
    }
  },
  '@media': {
    [narrow]: {
      justifyContent: 'flex-start'
    }
  }
})

export const contentLayout = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '190px minmax(0, 1fr)',
      gap: foundationVars.space[8],
      alignItems: 'start'
    }
  },
  '@media': {
    [narrow]: {
      gridTemplateColumns: '1fr',
      gap: foundationVars.space[5]
    }
  }
})

export const nav = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      top: foundationVars.space[5],
      display: 'grid',
      gap: foundationVars.space[1],
      paddingTop: foundationVars.space[1]
    }
  },
  '@media': {
    [narrow]: {
      position: 'static',
      display: 'flex',
      gap: foundationVars.space[2],
      overflowX: 'auto',
      paddingBottom: foundationVars.space[1],
      scrollbarWidth: 'thin'
    }
  }
})

export const navLink = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'alignItems': 'center',
      'minHeight': '40px',
      'padding': `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      'border': `1px solid transparent`,
      'borderRadius': foundationVars.radius.pill,
      'color': foundationVars.color.text.secondary,
      'fontSize': foundationVars.typography.caption.fontSize,
      'fontWeight': foundationVars.fontWeight.semibold,
      'lineHeight': 1.2,
      'textDecoration': 'none',
      'whiteSpace': 'nowrap',
      'transition': `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,

      ':hover': {
        borderColor: foundationVars.color.border.subtle,
        backgroundColor: foundationVars.color.nav.pillHover,
        color: foundationVars.color.text.primary
      },

      ':focus-visible': {
        boxShadow: foundationVars.shadow.focus,
        outline: 'none'
      }
    }
  }
})

export const sectionStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[8],
      minWidth: 0
    }
  }
})

export const section = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      scrollMarginTop: foundationVars.space[8]
    }
  }
})

export const sectionHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      paddingBottom: foundationVars.space[3],
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const sectionEyebrow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontFamily: foundationVars.font.mono,
      fontSize: '0.68rem',
      fontWeight: foundationVars.fontWeight.semibold,
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.heading.fontSize,
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '-0.02em',
      lineHeight: foundationVars.typography.heading.lineHeight
    }
  }
})

export const prose = style({
  '@layer': {
    [app]: {
      maxWidth: '74ch',
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.body.fontSize,
      lineHeight: '1.72'
    }
  }
})

globalStyle(`${prose} p`, {
  margin: `0 0 ${foundationVars.space[4]}`
})

globalStyle(`${prose} p:last-child`, {
  marginBottom: 0
})

globalStyle(`${prose} ul, ${prose} ol`, {
  margin: `0 0 ${foundationVars.space[4]}`,
  paddingLeft: foundationVars.space[5]
})

globalStyle(`${prose} strong`, {
  color: foundationVars.color.text.primary,
  fontWeight: foundationVars.fontWeight.semibold
})

export const factGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '1px',
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      backgroundColor: foundationVars.color.border.subtle
    }
  },
  '@media': {
    [mobile]: {
      gridTemplateColumns: '1fr'
    }
  }
})

export const fact = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px',
      minHeight: '68px',
      padding: foundationVars.space[3],
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const factLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontFamily: foundationVars.font.mono,
      fontSize: '0.68rem',
      fontWeight: foundationVars.fontWeight.semibold,
      letterSpacing: '0.07em',
      textTransform: 'uppercase'
    }
  }
})

export const factValue = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '1.35'
    }
  }
})

export const notice = styleVariants({
  draft: {
    '@layer': {
      [app]: {
        borderColor: foundationVars.color.accent.border,
        backgroundColor: foundationVars.color.accent.soft
      }
    }
  },
  warning: {
    '@layer': {
      [app]: {
        borderColor: foundationVars.color.status.warning,
        backgroundColor: foundationVars.color.status.warningSoft
      }
    }
  },
  info: {
    '@layer': {
      [app]: {
        borderColor: foundationVars.color.border.subtle,
        backgroundColor: foundationVars.color.surface.raised
      }
    }
  }
})

export const noticeBase = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      padding: foundationVars.space[4],
      border: '1px solid',
      borderRadius: foundationVars.radius.xl
    }
  },
  '@media': {
    [mobile]: {
      display: 'grid'
    }
  }
})

export const noticeText = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px'
    }
  }
})

export const noticeTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.bold
    }
  }
})

export const noticeBody = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const emptyBlock = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[5],
      border: `1px dashed ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const itemList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0,
      maxWidth: '78ch',
      borderTop: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const item = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      padding: `${foundationVars.space[4]} 0`,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const itemHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: foundationVars.space[3]
    }
  },
  '@media': {
    [mobile]: {
      display: 'grid'
    }
  }
})

export const itemTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.body.fontSize,
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '1.3'
    }
  }
})

export const itemMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontFamily: foundationVars.font.mono,
      fontSize: '0.72rem',
      fontWeight: foundationVars.fontWeight.semibold,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap'
    }
  }
})
