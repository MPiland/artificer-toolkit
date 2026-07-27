import { globalStyle, style, styleVariants } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

const narrow = 'screen and (max-width: 900px)'
const mobile = 'screen and (max-width: 640px)'
const shellHeaderHeight = '48px'
const stickyNavTop = `calc(${shellHeaderHeight} + ${foundationVars.space[5]})`
const sectionScrollMarginTop = `calc(${shellHeaderHeight} + ${foundationVars.space[8]})`

export const storyCanvas = style({
  '@layer': {
    [app]: {
      minHeight: '100dvh',
      padding: `${foundationVars.space[8]} ${foundationVars.space[6]}`,
      backgroundColor: foundationVars.color.surface.canvas,
      '@media': {
        [mobile]: {
          padding: foundationVars.space[4]
        }
      }
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
      gap: foundationVars.space[5],
      padding: foundationVars.space[6],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card,
      '@media': {
        [narrow]: {
          padding: foundationVars.space[5]
        }
      }
    }
  }
})

export const heroToolbar = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      '@media': {
        [mobile]: {
          display: 'grid'
        }
      }
    }
  }
})

export const heroMain = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      minWidth: 0,
      maxWidth: '76ch'
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
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.display,
      fontSize: '2.75rem',
      fontWeight: foundationVars.fontWeight.heavy,
      letterSpacing: '0',
      lineHeight: 1.08,
      '@media': {
        [mobile]: {
          fontSize: '2rem'
        }
      }
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
      justifyContent: 'flex-end',
      marginLeft: 'auto',
      '@media': {
        [narrow]: {
          justifyContent: 'flex-start'
        }
      }
    }
  }
})

export const dangerActionButton = style({
  '@layer': {
    [app]: {
      vars: {
        '--button-bg': foundationVars.color.status.dangerSoft,
        '--button-bd': `1px solid ${foundationVars.color.status.danger}`,
        '--button-color': foundationVars.color.status.danger,
        '--button-hover': foundationVars.color.status.dangerSoft,
        '--button-hover-color': foundationVars.color.status.danger
      },
      borderColor: foundationVars.color.status.danger,
      backgroundColor: foundationVars.color.status.dangerSoft,
      color: foundationVars.color.status.danger,
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,

      ':hover': {
        borderColor: foundationVars.color.status.danger,
        backgroundColor: foundationVars.color.status.dangerSoft,
        color: foundationVars.color.status.danger
      }
    }
  }
})

export const statusRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2],
      justifyContent: 'flex-start'
    }
  }
})

export const statusChip = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '24px',
      padding: `3px ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: '18px'
    }
  }
})

export const statusChipSrd = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.border.strong,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.secondary
    }
  }
})

export const statusChipHomebrew = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.border,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent
    }
  }
})

export const statusChipDraft = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.status.warning,
      backgroundColor: foundationVars.color.status.warningSoft,
      color: foundationVars.color.status.warning
    }
  }
})

export const contentLayout = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '190px minmax(0, 1fr)',
      gap: foundationVars.space[8],
      alignItems: 'start',
      '@media': {
        [narrow]: {
          gridTemplateColumns: '1fr',
          gap: foundationVars.space[5]
        }
      }
    }
  }
})

export const contentLayoutNoNav = style({
  '@layer': {
    [app]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: foundationVars.space[6]
    }
  }
})

export const nav = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      top: stickyNavTop,
      display: 'grid',
      gap: foundationVars.space[1],
      maxHeight: `calc(100dvh - ${stickyNavTop} - ${foundationVars.space[5]})`,
      overflowY: 'auto',
      paddingTop: foundationVars.space[1],
      overscrollBehavior: 'contain',
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
    }
  }
})

export const navLink = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      minHeight: '40px',
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      border: `1px solid transparent`,
      borderRadius: foundationVars.radius.pill,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: 1.2,
      textDecoration: 'none',
      whiteSpace: 'nowrap',
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,

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
      gap: foundationVars.space[7],
      minWidth: 0
    }
  }
})

export const section = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      scrollMarginTop: sectionScrollMarginTop
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
      lineHeight: '1.72',
      overflowX: 'auto'
    }
  }
})

globalStyle(`${prose} p`, {
  '@layer': {
    [app]: {
      margin: `0 0 ${foundationVars.space[4]}`
    }
  }
})

globalStyle(`${prose} p:last-child`, {
  '@layer': {
    [app]: {
      marginBottom: 0
    }
  }
})

globalStyle(`${prose} ul, ${prose} ol`, {
  '@layer': {
    [app]: {
      margin: `0 0 ${foundationVars.space[4]}`,
      paddingLeft: foundationVars.space[5]
    }
  }
})

globalStyle(`${prose} strong`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

globalStyle(`${prose} h3`, {
  '@layer': {
    [app]: {
      margin: `${foundationVars.space[5]} 0 ${foundationVars.space[2]}`,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.body.fontSize,
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '0'
    }
  }
})

globalStyle(`${prose} h3:first-child`, {
  '@layer': {
    [app]: {
      marginTop: 0
    }
  }
})

globalStyle(`${prose} table`, {
  '@layer': {
    [app]: {
      width: '100%',
      margin: `0 0 ${foundationVars.space[5]}`,
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderCollapse: 'separate',
      borderRadius: foundationVars.radius.md,
      borderSpacing: 0,
      backgroundColor: foundationVars.color.surface.panel,
      tableLayout: 'fixed'
    }
  }
})

globalStyle(`${prose} table:last-child`, {
  '@layer': {
    [app]: {
      marginBottom: 0
    }
  }
})

globalStyle(`${prose}:has(table[data-detail-table='class-progression'])`, {
  '@layer': {
    [app]: {
      maxWidth: '100%'
    }
  }
})

globalStyle(`${prose} th, ${prose} td`, {
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: '1.55',
      textAlign: 'left',
      verticalAlign: 'top',
      wordBreak: 'normal',
      overflowWrap: 'anywhere'
    }
  }
})

globalStyle(`${prose} th`, {
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.surface.raised,
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.mono,
      fontSize: '0.68rem',
      fontWeight: foundationVars.fontWeight.semibold,
      letterSpacing: '0.07em',
      textTransform: 'uppercase'
    }
  }
})

globalStyle(`${prose} td + td, ${prose} th + th`, {
  '@layer': {
    [app]: {
      borderLeft: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

globalStyle(`${prose} tr:last-child td`, {
  '@layer': {
    [app]: {
      borderBottom: 0
    }
  }
})

globalStyle(`${prose} table[data-detail-table='class-progression']`, {
  '@layer': {
    [app]: {
      minWidth: '980px',
      tableLayout: 'auto',
      fontVariantNumeric: 'tabular-nums'
    }
  }
})

globalStyle(
  `${prose} table[data-detail-table='class-progression'] th, ${prose} table[data-detail-table='class-progression'] td`,
  {
    '@layer': {
      [app]: {
        padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
        fontSize: '0.82rem',
        lineHeight: '1.38',
        overflowWrap: 'normal',
        wordBreak: 'normal'
      }
    }
  }
)

globalStyle(
  `${prose} table[data-detail-table='class-progression'] th[data-progression-column='features'], ${prose} table[data-detail-table='class-progression'] td[data-progression-column='features']`,
  {
    '@layer': {
      [app]: {
        minWidth: '18rem'
      }
    }
  }
)

globalStyle(
  `${prose} table[data-detail-table='class-progression'] th[data-progression-column='level'], ${prose} table[data-detail-table='class-progression'] td[data-progression-column='level'], ${prose} table[data-detail-table='class-progression'] th[data-progression-column='proficiency'], ${prose} table[data-detail-table='class-progression'] td[data-progression-column='proficiency'], ${prose} table[data-detail-table='class-progression'] th[data-progression-column='number'], ${prose} table[data-detail-table='class-progression'] td[data-progression-column='number'], ${prose} table[data-detail-table='class-progression'] th[data-progression-column='slot'], ${prose} table[data-detail-table='class-progression'] td[data-progression-column='slot']`,
  {
    '@layer': {
      [app]: {
        textAlign: 'center',
        whiteSpace: 'nowrap'
      }
    }
  }
)

globalStyle(
  `${prose} table[data-detail-table='class-progression'] th[data-progression-column='slot-group']`,
  {
    '@layer': {
      [app]: {
        textAlign: 'center'
      }
    }
  }
)

export const factGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(var(--authored-detail-fact-grid-columns, 4), minmax(0, 1fr))',
      gap: 0,
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.panel,
      '@media': {
        [narrow]: {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        },
        [mobile]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const fact = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px',
      minHeight: '76px',
      padding: foundationVars.space[3],
      backgroundColor: foundationVars.color.surface.panel,
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const afterFacts = style({
  '@layer': {
    [app]: {
      paddingTop: foundationVars.space[1]
    }
  }
})

export const pillList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const pillListLabel = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.muted,
      fontFamily: foundationVars.font.mono,
      fontSize: '0.68rem',
      fontWeight: foundationVars.fontWeight.semibold,
      letterSpacing: '0.07em',
      textTransform: 'uppercase'
    }
  }
})

export const pillListItems = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2]
    }
  }
})

export const pill = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '28px',
      padding: `0 ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: 1
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
      borderRadius: foundationVars.radius.xl,
      '@media': {
        [mobile]: {
          display: 'grid'
        }
      }
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
      gap: foundationVars.space[5],
      maxWidth: '78ch'
    }
  }
})

export const item = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      padding: 0
    }
  }
})

export const itemHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px',
      minWidth: 0
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
      lineHeight: 1.35
    }
  }
})
