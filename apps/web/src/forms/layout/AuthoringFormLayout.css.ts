import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'
const compactWorkspace = 'screen and (max-width: 940px)'

export const root = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space[2],
      width: '100%',
      maxWidth: 'none',
      height: 'var(--at-workspace-available-height, calc(100dvh - 112px))',
      minHeight: 0,
      margin: '0 auto',
      minWidth: 0,
      overflow: 'hidden',
      color: foundationVars.color.text.primary
    }
  }
})

export const storyCanvas = style({
  '@layer': {
    [app]: {
      'minHeight': '100dvh',
      'padding': 0,
      'backgroundColor': foundationVars.color.surface.canvas,
      '@media': {
        [mobile]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'alignItems': 'flex-start',
      'justifyContent': 'space-between',
      'gap': foundationVars.space[4],
      '@media': {
        [mobile]: {
          display: 'grid'
        }
      }
    }
  }
})

export const headerContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      minWidth: 0
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '26px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '1.2'
    }
  }
})

export const statusChip = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '24px',
      padding: `0 ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.surface.subtle,
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: 1
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

export const statusChipActive = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.border,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent
    }
  }
})

export const shell = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateRows': 'minmax(0, 1fr) auto',
      'flex': '1 1 auto',
      'height': 'auto',
      'minHeight': 0,
      'overflow': 'hidden',
      'backgroundColor': foundationVars.color.surface.canvas
    }
  }
})

export const shellWithRail = style({
  '@layer': {
    [app]: {
      'gridTemplateColumns': 'minmax(220px, 280px) minmax(0, 1fr)',
      'columnGap': foundationVars.space[3],
      '@media': {
        [compactWorkspace]: {
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: 'auto minmax(0, 1fr) auto'
        }
      }
    }
  }
})

export const shellWithPreview = style({
  '@layer': {
    [app]: {
      'gridTemplateColumns': 'minmax(0, 1fr) minmax(280px, 340px)',
      'columnGap': foundationVars.space[3],
      '@media': {
        [compactWorkspace]: {
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: 'auto minmax(0, 1fr) auto'
        }
      }
    }
  }
})

export const shellWithRailPreview = style({
  '@layer': {
    [app]: {
      'gridTemplateColumns': 'minmax(220px, 280px) minmax(0, 1fr) minmax(280px, 340px)',
      '@media': {
        [compactWorkspace]: {
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: 'auto minmax(0, 1fr) auto'
        }
      }
    }
  }
})

export const structureRail = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateRows': 'auto minmax(0, 1fr)',
      'alignContent': 'start',
      'gap': foundationVars.space[2],
      'minHeight': 0,
      'gridRow': '1 / -1',
      'padding': `${foundationVars.space[2]} ${foundationVars.space[3]} ${foundationVars.space[3]} ${foundationVars.space[1]}`,
      'borderRight': `1px solid ${foundationVars.color.border.strong}`,
      'backgroundColor': foundationVars.color.surface.sidebar,
      'overflow': 'auto',
      '@media': {
        [compactWorkspace]: {
          display: 'none'
        }
      }
    }
  }
})

export const previewRail = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'alignContent': 'start',
      'gap': foundationVars.space[2],
      'minHeight': 0,
      'padding': `${foundationVars.space[2]} ${foundationVars.space[2]} ${foundationVars.space[4]} 0`,
      'backgroundColor': 'transparent',
      'overflow': 'auto',
      '@media': {
        [compactWorkspace]: {
          display: 'none'
        }
      }
    }
  }
})

export const previewRailHeader = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[1]} ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.sidebar,
      color: foundationVars.color.text.primary,
      fontSize: '14px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '20px'
    }
  }
})

export const inspectorStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const inspectorSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: foundationVars.space[3],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const inspectorSectionHeader = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.label.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.label.lineHeight,
      letterSpacing: '0.02em',
      textTransform: 'uppercase'
    }
  }
})

export const inspectorPreviewText = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const inspectorMetaList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      margin: 0
    }
  }
})

export const inspectorMetaRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: foundationVars.space[2],
      padding: `${foundationVars.space[1]} ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const inspectorMetaTerm = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontWeight: foundationVars.fontWeight.medium
    }
  }
})

export const inspectorMetaValue = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.accent.solid,
      fontWeight: foundationVars.fontWeight.semibold,
      textAlign: 'right'
    }
  }
})

export const inspectorContextSummary = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: '16px'
    }
  }
})

export const inspectorSignalList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const inspectorSignal = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const inspectorSignalActive = style([
  inspectorSignal,
  {
    '@layer': {
      [app]: {
        borderColor: foundationVars.color.accent.border,
        backgroundColor: foundationVars.color.accent.soft,
        color: foundationVars.color.text.accent
      }
    }
  }
])

export const structureRailHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      padding: `${foundationVars.space[2]} ${foundationVars.space[2]} ${foundationVars.space[3]}`,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const structureRailEyebrow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.accent.solid,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '16px'
    }
  }
})

export const structureRailCurrent = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.primary,
      fontSize: '16px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '20px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const structureTree = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr) auto',
      gap: 2,
      minHeight: 0,
      height: '100%',
      paddingBlock: foundationVars.space[2],
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const structureTreeRoot = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '16px 16px minmax(0, 1fr)',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minHeight: 28,
      padding: `${foundationVars.space[1]} ${foundationVars.space[2]}`,
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.medium
    }
  }
})

export const structureTreeList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: 2,
      minHeight: 0,
      overflowY: 'auto',
      margin: 0,
      padding: 0,
      listStyle: 'none'
    }
  }
})

export const structureTreeItem = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 1
    }
  }
})

export const structureTreeRow = style({
  '@layer': {
    [app]: {
      'position': 'relative',
      'display': 'grid',
      'gridTemplateColumns': '16px 16px minmax(0, 1fr) auto',
      'alignItems': 'center',
      'gap': foundationVars.space[1],
      'minHeight': 28,
      'width': '100%',
      'padding': `${foundationVars.space[1]} ${foundationVars.space[2]} ${foundationVars.space[1]} ${foundationVars.space[6]}`,
      'border': 0,
      'borderRadius': foundationVars.radius.sm,
      'backgroundColor': 'transparent',
      'color': foundationVars.color.text.secondary,
      'font': 'inherit',
      'textAlign': 'left',
      'cursor': 'pointer',
      'transition': `background-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,

      ':hover': {
        backgroundColor: foundationVars.color.surface.subtle,
        color: foundationVars.color.text.primary
      },

      ':focus-visible': {
        boxShadow: foundationVars.shadow.focus,
        outline: 'none'
      }
    }
  }
})

export const structureTreeRowActive = style({
  '@layer': {
    [app]: {
      backgroundColor: 'rgba(236, 106, 6, 0.1)',
      color: foundationVars.color.accent.solid,
      fontWeight: foundationVars.fontWeight.bold,

      selectors: {
        '&::before': {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 3,
          borderTopLeftRadius: foundationVars.radius.sm,
          borderBottomLeftRadius: foundationVars.radius.sm,
          backgroundColor: foundationVars.color.accent.solid,
          content: ''
        }
      }
    }
  }
})

export const structureTreeChevron = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary
    }
  }
})

export const structureTreeChevronMuted = style({
  '@layer': {
    [app]: {
      color: 'transparent'
    }
  }
})

export const structureTreeIcon = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted
    }
  }
})

export const structureTreeLabel = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const structureTreeStatus = style({
  '@layer': {
    [app]: {
      width: 8,
      height: 8,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.status.warning
    }
  }
})

export const structureTreeChildren = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 1,
      margin: 0,
      padding: 0,
      listStyle: 'none'
    }
  }
})

export const structureTreeChild = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '16px minmax(0, 1fr)',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minHeight: 26,
      padding: `${foundationVars.space[1]} ${foundationVars.space[2]} ${foundationVars.space[1]} ${foundationVars.space[10]}`,
      color: foundationVars.color.text.muted,
      fontSize: '12px',
      lineHeight: '16px'
    }
  }
})

export const structureTreeChildRail = style({
  '@layer': {
    [app]: {
      width: 10,
      height: 1,
      backgroundColor: foundationVars.color.border.strong
    }
  }
})

export const structureTreeChildLabel = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const structureTreeFooter = style({
  '@layer': {
    [app]: {
      marginTop: foundationVars.space[3],
      padding: `${foundationVars.space[2]} ${foundationVars.space[2]} 0`,
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[2],
      color: foundationVars.color.text.muted,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: '16px'
    }
  }
})

export const structureTreeFooterSignal = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minWidth: 0
    }
  }
})

export const structureTreeFooterDot = style({
  '@layer': {
    [app]: {
      width: 8,
      height: 8,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.status.danger
    }
  }
})

export const structureTreeFooterDotMuted = style({
  '@layer': {
    [app]: {
      width: 8,
      height: 8,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.text.muted
    }
  }
})

export const structureSectionList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      marginTop: foundationVars.space[1],
      padding: `${foundationVars.space[2]} ${foundationVars.space[2]} 0 ${foundationVars.space[5]}`,
      borderTop: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const structureSectionItem = style({
  '@layer': {
    [app]: {
      display: 'block',
      overflow: 'hidden',
      padding: `${foundationVars.space[1]} ${foundationVars.space[2]}`,
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.muted,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: '18px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const drawerNav = style({
  '@layer': {
    [app]: {
      paddingBlock: foundationVars.space[2]
    }
  }
})

export const mobileStructureBar = style({
  '@layer': {
    [app]: {
      'display': 'none',
      'alignItems': 'center',
      'justifyContent': 'space-between',
      'flexWrap': 'wrap',
      'gap': foundationVars.space[3],
      'paddingBottom': foundationVars.space[3],
      '@media': {
        [compactWorkspace]: {
          display: 'flex'
        },
        [mobile]: {
          alignItems: 'center'
        }
      }
    }
  }
})

export const mobileStructureCurrent = style({
  '@layer': {
    [app]: {
      flex: '1 1 auto',
      minWidth: '8rem',
      overflow: 'hidden',
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight,
      textAlign: 'right',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const actionBarSlot = style({
  '@layer': {
    [app]: {
      'vars': {
        '--at-authoring-action-max-width': 'none'
      },
      'gridColumn': '1 / -1',
      'alignSelf': 'end',
      '@media': {
        [compactWorkspace]: {
          vars: {
            '--at-authoring-action-max-width': '900px'
          },
          gridColumn: '1 / -1'
        }
      }
    }
  }
})

export const actionBarSlotWithRail = style({
  '@layer': {
    [app]: {
      'gridColumn': '2 / -1',
      '@media': {
        [compactWorkspace]: {
          gridColumn: '1 / -1'
        }
      }
    }
  }
})

export const contentScroller = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'alignContent': 'start',
      'gap': foundationVars.space[4],
      'minHeight': 0,
      'overflowX': 'hidden',
      'overflowY': 'auto',
      'padding': `${foundationVars.space[3]} ${foundationVars.space[3]} ${foundationVars.space[4]}`,
      'scrollbarGutter': 'stable'
    }
  }
})

export const editorHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      paddingBottom: foundationVars.space[3],
      borderBottom: `1px solid ${foundationVars.color.border.strong}`
    }
  }
})

export const editorHeaderMain = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      minWidth: 0
    }
  }
})

export const editorBreadcrumb = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: foundationVars.space[2],
      margin: 0,
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const editorTitleRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: foundationVars.space[3],
      minWidth: 0
    }
  }
})

export const editorTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '28px',
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '0',
      lineHeight: '34px'
    }
  }
})

export const editorTypeChip = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 24,
      paddingInline: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.raised,
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '16px'
    }
  }
})

export const sectionStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[4]
    }
  }
})

export const section = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.panel,
      transition: `border-color ${foundationVars.motion.fast} ease`,

      ':hover': {
        borderColor: foundationVars.color.border.strong
      }
    }
  }
})

export const sectionHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      width: '100%'
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '14px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '22px',
      letterSpacing: '0.28px',
      textTransform: 'uppercase'
    }
  }
})

export const sectionCopy = style({
  '@layer': {
    [app]: {
      maxWidth: '68ch',
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const mutedText = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary
    }
  }
})

export const dangerIconButton = style({
  '@layer': {
    [app]: {
      'vars': {
        '--ai-bg': foundationVars.color.input.background.default,
        '--ai-bd': `1px solid ${foundationVars.color.status.danger}`,
        '--ai-color': foundationVars.color.status.danger,
        '--ai-hover': foundationVars.color.status.dangerSoft,
        '--ai-hover-color': foundationVars.color.status.danger
      },
      'borderColor': foundationVars.color.status.danger,
      'borderRadius': foundationVars.radius.sm,
      'backgroundColor': foundationVars.color.input.background.default,
      'color': foundationVars.color.status.danger,
      'transition': `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,

      ':hover': {
        borderColor: foundationVars.color.status.danger,
        backgroundColor: foundationVars.color.status.dangerSoft,
        color: foundationVars.color.status.danger
      }
    }
  }
})
