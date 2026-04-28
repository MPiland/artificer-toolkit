import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobileBreakpoint = 'screen and (max-width: 760px)'

export const listStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5]
    }
  }
})

export const toolbar = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(16rem, 320px) repeat(4, minmax(10rem, 160px)) auto minmax(0, 1fr)',
      alignItems: 'end',
      gap: foundationVars.space[3]
    }
  },
  '@media': {
    [mobileBreakpoint]: {
      gridTemplateColumns: '1fr'
    }
  }
})

export const viewToggleGroup = style({
  '@layer': {
    [app]: {
      alignSelf: 'end',
      display: 'inline-flex',
      minHeight: '42px',
      padding: '3px',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.input.background.default
    }
  },
  '@media': {
    [mobileBreakpoint]: {
      minHeight: '52px'
    }
  }
})

export const viewToggleButton = style({
  '@layer': {
    [app]: {
      width: '34px',
      height: '34px',
      border: '1px solid transparent',
      borderRadius: foundationVars.radius.sm,
      backgroundColor: 'transparent',
      color: foundationVars.color.text.secondary,

      ':hover': {
        borderColor: foundationVars.color.border.subtle,
        backgroundColor: foundationVars.color.card.background.hover,
        color: foundationVars.color.text.primary
      },

      ':focus-visible': {
        boxShadow: foundationVars.shadow.focus
      }
    }
  },
  '@media': {
    [mobileBreakpoint]: {
      width: '44px',
      height: '44px'
    }
  }
})

export const viewToggleButtonActive = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.border,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent
    }
  }
})

globalStyle(`${viewToggleButton} svg`, {
  width: '18px',
  height: '18px',
  display: 'block'
})

export const fieldInput = style({
  '@layer': {
    [app]: {
      minHeight: '42px',
      borderColor: foundationVars.color.input.border.default,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,

      ':focus': {
        borderColor: foundationVars.color.input.border.focus,
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const fieldLabel = style({
  '@layer': {
    [app]: {
      marginBottom: '4px',
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.label.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.label.lineHeight
    }
  }
})

export const tableShell = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      borderRadius: foundationVars.radius.lg,
      backgroundColor: 'transparent'
    }
  }
})

export const tableScroll = style({
  '@layer': {
    [app]: {
      maxHeight: 'min(70dvh, 760px)',
      overflow: 'auto',
      borderRadius: foundationVars.radius.lg,
      scrollbarGutter: 'stable both-edges'
    }
  }
})

export const table = style({
  '@layer': {
    [app]: {
      minWidth: '1188px',
      borderCollapse: 'separate',
      borderSpacing: '0 10px'
    }
  }
})

globalStyle(`${table} thead`, {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  backgroundColor: foundationVars.color.surface.panel
})

globalStyle(`${table} th`, {
  height: '36px',
  padding: `0 ${foundationVars.space[2]}`,
  borderTop: `1px solid ${foundationVars.color.border.subtle}`,
  borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
  color: foundationVars.color.text.muted,
  fontFamily: foundationVars.font.mono,
  fontSize: '11px',
  fontWeight: foundationVars.fontWeight.medium,
  letterSpacing: '0.04em',
  textAlign: 'left',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap'
})

globalStyle(`${table} th:first-child`, {
  borderLeft: `1px solid ${foundationVars.color.border.subtle}`
})

globalStyle(`${table} th:last-child`, {
  borderRight: `1px solid ${foundationVars.color.border.subtle}`
})

globalStyle(`${table} td`, {
  height: '52px',
  padding: `0 ${foundationVars.space[2]}`,
  borderTop: `1px solid ${foundationVars.color.border.strong}`,
  borderBottom: `1px solid ${foundationVars.color.border.strong}`,
  color: foundationVars.color.text.secondary,
  fontSize: foundationVars.typography.bodySm.fontSize,
  whiteSpace: 'nowrap'
})

globalStyle(`${table} td:first-child`, {
  borderLeft: `1px solid ${foundationVars.color.border.strong}`
})

globalStyle(`${table} td:last-child`, {
  borderRight: `1px solid ${foundationVars.color.border.strong}`
})

export const listRow = style({
  '@layer': {
    [app]: {
      cursor: 'pointer',
      outline: 'none',
      transition: `background-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease`,

      ':hover': {
        backgroundColor: foundationVars.color.card.background.hover
      },

      ':focus-visible': {
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

globalStyle(`${listRow}:hover td`, {
  backgroundColor: foundationVars.color.card.background.hover
})

globalStyle(`${listRow}:focus-visible td`, {
  borderColor: foundationVars.color.accent.border
})

export const dotCell = style({
  '@layer': {
    [app]: {
      width: '32px',
      paddingInline: foundationVars.space[3]
    }
  }
})

export const sourceDot = style({
  '@layer': {
    [app]: {
      display: 'block',
      width: '8px',
      height: '8px',
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.accent.solid
    }
  }
})

export const masterDot = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.text.muted
    }
  }
})

export const nameCell = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.medium
    }
  }
})

export const monoCell = style({
  '@layer': {
    [app]: {
      fontFamily: foundationVars.font.mono
    }
  }
})

export const chipGroup = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2]
    }
  }
})

export const classChip = style({
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

export const sourceChip = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '24px',
      padding: `3px ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: '18px'
    }
  }
})

export const masterSourceChip = style({
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

export const actionCell = style({
  '@layer': {
    [app]: {
      width: '132px'
    }
  }
})

export const rowActionButton = style({
  '@layer': {
    [app]: {
      width: '34px',
      height: '34px',
      borderColor: foundationVars.color.button.secondary.border,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.button.secondary.background,
      color: foundationVars.color.button.secondary.text,

      ':hover': {
        borderColor: foundationVars.color.accent.border,
        backgroundColor: foundationVars.color.accent.soft,
        color: foundationVars.color.text.accent
      }
    }
  },
  '@media': {
    [mobileBreakpoint]: {
      width: '44px',
      height: '44px'
    }
  }
})

export const dangerActionButton = style({
  '@layer': {
    [app]: {
      ':hover': {
        borderColor: foundationVars.color.status.danger,
        backgroundColor: foundationVars.color.status.dangerSoft,
        color: foundationVars.color.status.danger
      }
    }
  }
})

globalStyle(`${rowActionButton} svg`, {
  width: '17px',
  height: '17px',
  display: 'block'
})

export const moreActionButton = style({
  '@layer': {
    [app]: {
      width: '44px',
      height: '44px',
      borderColor: foundationVars.color.button.secondary.border,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.button.secondary.background,
      color: foundationVars.color.button.secondary.text
    }
  }
})

globalStyle(`${moreActionButton} svg`, {
  width: '20px',
  height: '20px',
  display: 'block'
})

export const cardViewport = style({
  '@layer': {
    [app]: {
      maxHeight: 'min(72dvh, 820px)',
      overflow: 'auto',
      borderRadius: foundationVars.radius.lg,
      scrollbarGutter: 'stable both-edges'
    }
  }
})

export const cardStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3]
    }
  }
})

export const cardRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(var(--authored-list-card-columns), minmax(0, 1fr))',
      gap: foundationVars.space[3]
    }
  }
})

export const card = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'alignContent': 'space-between',
      'gap': foundationVars.space[4],
      'minHeight': '176px',
      'padding': foundationVars.space[4],
      'border': `1px solid ${foundationVars.color.border.strong}`,
      'borderRadius': foundationVars.radius.lg,
      'backgroundColor': foundationVars.color.surface.panel,
      'cursor': 'pointer',
      'transition': `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease`,

      ':hover': {
        borderColor: foundationVars.color.accent.border,
        backgroundColor: foundationVars.color.card.background.hover,
        boxShadow: foundationVars.shadow.cardHover
      },

      ':focus-visible': {
        outline: `2px solid ${foundationVars.color.accent.solid}`,
        outlineOffset: '2px',
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const cardHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[3]
    }
  }
})

export const cardTitleGroup = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      minWidth: 0,
      gap: foundationVars.space[2]
    }
  }
})

export const cardTitleStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minWidth: 0,
      gap: '2px'
    }
  }
})

export const cardTitle = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.body.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.body.lineHeight,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const cardSubline = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.caption.lineHeight,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const cardFeatureRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      minWidth: 0
    }
  }
})

export const levelBadge = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '28px',
      padding: `4px ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.caption.lineHeight,
      whiteSpace: 'nowrap'
    }
  }
})

export const cardFeatureText = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const cardFooter = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3]
    }
  }
})

export const statePanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'center',
      gap: foundationVars.space[3],
      padding: foundationVars.space[8],
      color: foundationVars.color.text.secondary,
      textAlign: 'center'
    }
  }
})
