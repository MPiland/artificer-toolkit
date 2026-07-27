import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobileBreakpoint = 'screen and (max-width: 760px)'

export const listStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto auto auto minmax(0, 1fr)',
      height: `calc(100dvh - 48px - ${foundationVars.space[8]} - ${foundationVars.space[8]})`,
      minWidth: 0,
      minHeight: 0,
      gap: foundationVars.space[5],
      '@media': {
        [mobileBreakpoint]: {
          height: 'auto'
        }
      }
    }
  }
})

export const contentTabs = style({
  '@layer': {
    [app]: {
      justifySelf: 'start'
    }
  }
})

export const toolbar = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'end',
      gap: foundationVars.space[3],
      minWidth: 0,
      '@media': {
        [mobileBreakpoint]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const filterControls = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(16rem, 320px) repeat(auto-fit, minmax(10rem, 160px))',
      alignItems: 'end',
      gap: foundationVars.space[3],
      minWidth: 0,
      '@media': {
        [mobileBreakpoint]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const viewToggleGroup = style({
  '@layer': {
    [app]: {
      alignSelf: 'end',
      justifySelf: 'end',
      display: 'inline-flex',
      minHeight: '42px',
      padding: '3px',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.input.background.default,
      '@media': {
        [mobileBreakpoint]: {
          justifySelf: 'start',
          minHeight: '52px'
        }
      }
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
      },

      ':disabled': {
        cursor: 'not-allowed',
        opacity: 0.5
      },
      '@media': {
        [mobileBreakpoint]: {
          width: '44px',
          height: '44px'
        }
      }
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

export const tableShell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr)',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
      backgroundColor: 'transparent'
    }
  }
})

export const tableScroll = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: '100%',
      minWidth: 0,
      maxWidth: '100%',
      overflow: 'auto'
    }
  }
})

export const table = style({
  '@layer': {
    [app]: {
      width: '100%',
      minWidth: '1188px',
      borderCollapse: 'separate',
      borderSpacing: 0,
      tableLayout: 'fixed'
    }
  }
})

export const tableHead = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      top: 0,
      zIndex: 2,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const tableHeaderCell = style({
  '@layer': {
    [app]: {
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
    }
  }
})

export const tableHeaderEdgeStart = style({
  '@layer': {
    [app]: {
      borderLeft: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const tableHeaderEdgeEnd = style({
  '@layer': {
    [app]: {
      borderRight: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const tableBodyCell = style({
  '@layer': {
    [app]: {
      height: '52px',
      padding: `0 ${foundationVars.space[2]}`,
      borderTop: `1px solid ${foundationVars.color.border.strong}`,
      borderBottom: `1px solid ${foundationVars.color.border.strong}`,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      whiteSpace: 'nowrap',
      selectors: {
        'tr:hover &': {
          backgroundColor: foundationVars.color.card.background.hover
        },
        'tr:focus-visible &': {
          borderColor: foundationVars.color.accent.border
        }
      }
    }
  }
})

export const tableBodyEdgeStart = style({
  '@layer': {
    [app]: {
      borderLeft: `1px solid ${foundationVars.color.border.strong}`
    }
  }
})

export const tableBodyEdgeEnd = style({
  '@layer': {
    [app]: {
      borderRight: `1px solid ${foundationVars.color.border.strong}`
    }
  }
})

export const spacerCell = style({
  '@layer': {
    [app]: {
      padding: 0,
      border: 0
    }
  }
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
      backgroundColor: `var(--authored-list-accent, ${foundationVars.color.accent.solid})`
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

export const nameColumnNoAccent = style({
  '@layer': {
    [app]: {
      paddingLeft: foundationVars.space[4]
    }
  }
})

export const itemNameButton = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      maxWidth: '100%',
      padding: 0,
      border: 0,
      background: 'transparent',
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      font: 'inherit',
      fontWeight: foundationVars.fontWeight.medium,
      textAlign: 'left',

      ':hover': {
        color: foundationVars.color.text.accent
      },

      ':focus-visible': {
        borderRadius: foundationVars.radius.sm,
        boxShadow: foundationVars.shadow.focus,
        outline: 'none'
      }
    }
  }
})

export const nameHierarchy = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      maxWidth: '100%',
      gap: foundationVars.space[2],
      paddingLeft: `calc(var(--authored-list-hierarchy-level, 0) * ${foundationVars.space[5]})`
    }
  }
})

export const hierarchyMarker = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      width: '14px',
      height: '1px',
      backgroundColor: foundationVars.color.border.strong
    }
  }
})

export const monoCell = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      fontFamily: foundationVars.font.mono
    }
  }
})

export const chipCell = style({
  '@layer': {
    [app]: {
      overflow: 'hidden'
    }
  }
})

export const chipGroup = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2],
      minWidth: 0
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

export const statusCell = style({
  '@layer': {
    [app]: {
      overflow: 'hidden'
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

export const statusChipDraft = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.status.warning,
      backgroundColor: foundationVars.color.status.warningSoft,
      color: foundationVars.color.status.warning
    }
  }
})

export const actionCell = style({
  '@layer': {
    [app]: {
      textAlign: 'left',
      width: '132px'
    }
  }
})

export const rowActionButton = style({
  '@layer': {
    [app]: {
      vars: {
        '--ai-bg': foundationVars.color.input.background.default,
        '--ai-bd': `1px solid ${foundationVars.color.accent.border}`,
        '--ai-color': foundationVars.color.text.accent,
        '--ai-hover': foundationVars.color.accent.soft,
        '--ai-hover-color': foundationVars.color.text.accent
      },
      width: '34px',
      height: '34px',
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderColor: foundationVars.color.accent.border,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.accent,
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,

      ':hover': {
        borderColor: foundationVars.color.accent.border,
        backgroundColor: foundationVars.color.accent.soft,
        color: foundationVars.color.text.accent
      },

      ':focus-visible': {
        boxShadow: foundationVars.shadow.focus
      },
      '@media': {
        [mobileBreakpoint]: {
          width: '44px',
          height: '44px'
        }
      }
    }
  }
})

export const dangerActionButton = style({
  '@layer': {
    [app]: {
      vars: {
        '--ai-bg': foundationVars.color.input.background.default,
        '--ai-bd': `1px solid ${foundationVars.color.status.danger}`,
        '--ai-color': foundationVars.color.status.danger,
        '--ai-hover': foundationVars.color.status.dangerSoft,
        '--ai-hover-color': foundationVars.color.status.danger
      },
      backgroundColor: foundationVars.color.input.background.default,
      borderColor: foundationVars.color.status.danger,
      color: foundationVars.color.status.danger,

      ':hover': {
        borderColor: foundationVars.color.status.danger,
        backgroundColor: foundationVars.color.status.dangerSoft,
        color: foundationVars.color.status.danger
      }
    }
  }
})

export const copyActionButton = style({
  '@layer': {
    [app]: {
      vars: {
        '--ai-bg': foundationVars.color.input.background.default,
        '--ai-bd': `1px solid ${foundationVars.color.accent.tertiaryBorder}`,
        '--ai-color': foundationVars.color.accent.tertiarySolid,
        '--ai-hover': foundationVars.color.accent.tertiarySoft,
        '--ai-hover-color': foundationVars.color.accent.tertiaryHover
      },
      border: `1px solid ${foundationVars.color.accent.tertiaryBorder}`,
      borderColor: foundationVars.color.accent.tertiaryBorder,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.accent.tertiarySolid,

      ':hover': {
        borderColor: foundationVars.color.accent.tertiaryBorder,
        backgroundColor: foundationVars.color.accent.tertiarySoft,
        color: foundationVars.color.accent.tertiaryHover
      }
    }
  }
})

export const dangerMenuItem = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.danger,

      ':hover': {
        backgroundColor: foundationVars.color.status.dangerSoft,
        color: foundationVars.color.status.danger
      }
    }
  }
})

export const copyMenuItem = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.accent.tertiarySolid,

      ':hover': {
        backgroundColor: foundationVars.color.accent.tertiarySoft,
        color: foundationVars.color.accent.tertiaryHover
      }
    }
  }
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

export const cardViewport = style({
  '@layer': {
    [app]: {
      maxHeight: 'min(72dvh, 820px)',
      overflow: 'auto',
      borderRadius: foundationVars.radius.lg
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
      display: 'grid',
      alignContent: 'space-between',
      gap: foundationVars.space[4],
      minHeight: '176px',
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.panel,
      cursor: 'pointer',
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease`,

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

export const cardMetaGroup = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      flexShrink: 0,
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2]
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

export const cardTitleButton = style({
  '@layer': {
    [app]: {
      display: 'inline-block',
      overflow: 'hidden',
      maxWidth: '100%',
      padding: 0,
      border: 0,
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      font: 'inherit',
      fontWeight: 'inherit',
      textAlign: 'left',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',

      ':hover': {
        color: foundationVars.color.text.accent
      },

      ':focus-visible': {
        borderRadius: foundationVars.radius.sm,
        boxShadow: foundationVars.shadow.focus,
        outline: 'none'
      }
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

export const cardFooterMeta = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      minWidth: 0,
      gap: foundationVars.space[2]
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
