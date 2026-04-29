import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const sectionPanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: '0 0 14px',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: 'transparent'
    }
  }
})

export const effectCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      padding: '12px 0',
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: 0,
      backgroundColor: 'transparent'
    }
  }
})

export const effectCardHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3]
    }
  }
})

export const effectEditor = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5]
    }
  }
})

export const editorFrame = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr) auto',
      minHeight: '100dvh',
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

export const editorHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[6],
      minHeight: '64px',
      padding: `${foundationVars.space[3]} ${foundationVars.space[13]}`,
      borderBottom: `1px solid ${foundationVars.color.border.strong}`,
      backgroundColor: foundationVars.color.surface.header
    }
  },
  '@media': {
    [mobile]: {
      alignItems: 'flex-start',
      gap: foundationVars.space[3],
      minHeight: 'auto',
      padding: `calc(12px + env(safe-area-inset-top)) ${foundationVars.space[4]} 12px`
    }
  }
})

export const editorBreadcrumbs = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: foundationVars.space[2],
      minWidth: 0,
      color: foundationVars.color.text.muted,
      fontSize: '13px',
      fontWeight: foundationVars.fontWeight.medium
    }
  },
  '@media': {
    [mobile]: {
      flexWrap: 'nowrap',
      overflow: 'hidden'
    }
  }
})

globalStyle(`${editorBreadcrumbs} > span`, {
  '@layer': {
    [app]: {
      flexShrink: 0
    }
  }
})

export const editorBreadcrumbLink = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent
    }
  }
})

export const editorBreadcrumbCurrent = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.semibold,
      flexShrink: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const editorContent = style({
  '@layer': {
    [app]: {
      overflow: 'auto',
      padding: `${foundationVars.space[6]} min(102px, 6vw)`,
      backgroundColor: foundationVars.color.surface.canvas
    }
  },
  '@media': {
    [mobile]: {
      padding: foundationVars.space[4]
    }
  }
})

export const editorContentInner = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5],
      maxWidth: '880px'
    }
  }
})

export const editorFooter = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      minHeight: '56px',
      padding: `${foundationVars.space[2]} ${foundationVars.space[13]}`,
      borderTop: `1px solid ${foundationVars.color.border.strong}`,
      backgroundColor: foundationVars.color.surface.header
    }
  },
  '@media': {
    [mobile]: {
      padding: `8px ${foundationVars.space[4]} calc(8px + env(safe-area-inset-bottom))`
    }
  }
})

export const editorPanel = style({
  '@layer': {
    [app]: {
      margin: 0,
      padding: 0,
      border: 0,
      borderRadius: 0,
      backgroundColor: 'transparent',
      outline: 'none'
    }
  }
})

export const sectionTrigger = style({
  '@layer': {
    [app]: {
      minHeight: '36px',
      padding: '0',
      color: foundationVars.color.text.primary
    }
  }
})

export const sectionBody = style({
  '@layer': {
    [app]: {
      padding: '8px 0 14px'
    }
  }
})

export const sectionKicker = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '14px',
      fontWeight: foundationVars.fontWeight.semibold,
      letterSpacing: '0.01em',
      textTransform: 'uppercase'
    }
  }
})

export const sectionHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[4]
    }
  }
})

export const collapseChevron = style({
  '@layer': {
    [app]: {
      width: '14px',
      height: '14px',
      color: foundationVars.color.icon.default,
      transition: `transform ${foundationVars.motion.base} ease`
    }
  },
  'selectors': {
    [`${editorPanel} [data-state="closed"] &`]: {
      transform: 'rotate(180deg)'
    }
  }
})

export const actionIcon = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.icon.default
    }
  }
})

export const pathSummaryRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto auto',
      alignItems: 'center',
      gap: foundationVars.space[4],
      minHeight: '58px',
      padding: `${foundationVars.space[2]} 0`
    }
  },
  '@media': {
    [mobile]: {
      gridTemplateColumns: '1fr auto',
      gap: foundationVars.space[3]
    }
  }
})

export const pathStatus = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.medium
    }
  }
})

export const outcomeList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0
    }
  }
})

export const outcomeRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '40px minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: foundationVars.space[4],
      minHeight: '62px',
      padding: '8px 0'
    }
  }
})

export const outcomePrimaryRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '56px minmax(0, 1fr) 64px',
      alignItems: 'center',
      gap: foundationVars.space[4],
      minHeight: '56px',
      padding: `${foundationVars.space[2]} 0`
    }
  },
  '@media': {
    [mobile]: {
      gridTemplateColumns: '44px minmax(0, 1fr) auto'
    }
  }
})

export const outcomeRollBadge = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '36px',
      minHeight: '24px',
      padding: '4px 8px',
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.medium
    }
  },
  'selectors': {
    '&:empty': {
      visibility: 'hidden'
    }
  }
})

export const outcomeRowText = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px',
      minWidth: 0
    }
  }
})

export const outcomeActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2]
    }
  }
})

export const destructiveActionIcon = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.danger
    }
  }
})

export const editorContext = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '14px'
    }
  }
})

export const outcomeMenuItem = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px',
      padding: '2px 0'
    }
  }
})

export const outcomeMenuDropdown = style({
  '@layer': {
    [app]: {
      maxHeight: 'min(420px, calc(100dvh - 160px))',
      overflowY: 'auto'
    }
  }
})

export const rangeBadge = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '38px',
      height: '24px',
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.secondary,
      fontSize: '12px'
    }
  }
})

export const editorGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: foundationVars.space[4]
    }
  },
  '@media': {
    [mobile]: {
      gridTemplateColumns: '1fr'
    }
  }
})

export const outcomeGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: foundationVars.space[3]
    }
  },
  '@media': {
    [mobile]: {
      gridTemplateColumns: '1fr'
    }
  }
})

export const outcomeCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      padding: `${foundationVars.space[2]} 0`,
      border: 0,
      borderRadius: 0,
      backgroundColor: 'transparent'
    }
  },
  'selectors': {
    '& + &': {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const outcomeAddButton = style({
  '@layer': {
    [app]: {
      justifySelf: 'start',
      marginTop: foundationVars.space[2],
      borderRadius: foundationVars.radius.md
    }
  }
})

globalStyle(`${editorFrame} .mantine-InputWrapper-label`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.label.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.label.lineHeight
    }
  }
})

globalStyle(`${editorFrame} .mantine-InputWrapper-description`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

globalStyle(`${editorFrame} .mantine-Input-input`, {
  '@layer': {
    [app]: {
      minHeight: '40px',
      borderColor: foundationVars.color.input.border.default,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.primary,
      fontSize: '14px'
    }
  }
})

globalStyle(`${editorFrame} .mantine-Input-input:disabled, ${editorFrame} .mantine-Input-input[readonly], ${editorFrame} .mantine-Input-input[data-disabled="true"]`, {
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.input.border.disabled,
      backgroundColor: foundationVars.color.input.background.disabled,
      color: foundationVars.color.text.muted
    }
  }
})
