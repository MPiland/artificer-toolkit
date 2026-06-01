import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'
const compactWorkspace = 'screen and (max-width: 940px)'

export const shell = style({
  '@layer': {
    [app]: {
      position: 'fixed',
      inset: 0,
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr) auto',
      height: '100dvh',
      overflow: 'hidden',
      background: foundationVars.color.surface.canvas
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'alignItems': 'center',
      'justifyContent': 'space-between',
      'gap': foundationVars.space[4],
      'minHeight': '48px',
      'padding': `0 ${foundationVars.space[4]}`,
      'borderBottom': `1px solid ${foundationVars.color.border.strong}`,
      '@media': {
        [mobile]: {
          padding: `0 ${foundationVars.space[4]}`
        }
      }
    }
  }
})

export const headerMain = style({
  '@layer': {
    [app]: {
      minWidth: 0
    }
  }
})

export const titleStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 2,
      minWidth: 0
    }
  }
})

export const contextLine = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '13px',
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: '18px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const titleLine = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '18px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '24px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const headerActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      flexShrink: 0
    }
  }
})

export const removeAction = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.danger,
      borderColor: foundationVars.color.status.danger,
      background: foundationVars.color.surface.panel
    }
  }
})

export const visuallyHidden = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: 0,
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0
    }
  }
})

export const workspace = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'alignContent': 'start',
      'gap': foundationVars.space[5],
      'width': '100%',
      'maxWidth': 'none',
      'marginInline': 'auto',
      'padding': foundationVars.space[4],
      'overflow': 'auto',
      '@media': {
        [mobile]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const workspaceWithPreview = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateColumns': 'minmax(0, 1fr) minmax(280px, 340px)',
      'alignContent': 'start',
      'gap': foundationVars.space[4],
      'width': '100%',
      'maxWidth': 'none',
      'marginInline': 'auto',
      'padding': foundationVars.space[4],
      'overflow': 'auto',
      '@media': {
        [compactWorkspace]: {
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: foundationVars.space[4]
        },
        [mobile]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const workspaceWithRail = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateColumns': 'minmax(220px, 280px) minmax(0, 1fr)',
      'alignContent': 'start',
      'gap': foundationVars.space[4],
      'width': '100%',
      'maxWidth': 'none',
      'marginInline': 'auto',
      'padding': foundationVars.space[4],
      'overflow': 'auto',
      '@media': {
        [compactWorkspace]: {
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: foundationVars.space[4]
        },
        [mobile]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const workspaceWithRailPreview = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateColumns': 'minmax(220px, 280px) minmax(0, 1fr) minmax(280px, 340px)',
      'alignContent': 'start',
      'gap': foundationVars.space[4],
      'width': '100%',
      'maxWidth': 'none',
      'marginInline': 'auto',
      'padding': foundationVars.space[4],
      'overflow': 'auto',
      '@media': {
        [compactWorkspace]: {
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: foundationVars.space[4]
        },
        [mobile]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const structureRail = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'alignContent': 'start',
      'gap': foundationVars.space[3],
      'minHeight': 0,
      'padding': `${foundationVars.space[3]} ${foundationVars.space[3]} ${foundationVars.space[3]} 0`,
      'borderRight': `1px solid ${foundationVars.color.border.strong}`,
      'backgroundColor': foundationVars.color.surface.sidebar,
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
      'gap': foundationVars.space[3],
      'minHeight': 0,
      'padding': 0,
      'backgroundColor': 'transparent',
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
      padding: `0 ${foundationVars.space[1]} ${foundationVars.space[2]}`,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.primary,
      fontSize: '14px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '20px'
    }
  }
})

export const insightStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3]
    }
  }
})

export const insightSection = style({
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

export const insightSectionHeader = style({
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

export const insightPreviewText = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const insightMetaList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      margin: 0
    }
  }
})

export const insightMetaRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const insightMetaTerm = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontWeight: foundationVars.fontWeight.medium
    }
  }
})

export const insightMetaValue = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

export const insightSignalList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const insightSignal = style({
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

export const insightSignalActive = style([
  insightSignal,
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
      padding: `0 ${foundationVars.space[1]} ${foundationVars.space[2]}`,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const structureRailEyebrow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
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
      fontSize: '14px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '20px',
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

export const content = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[5],
      minWidth: 0
    }
  }
})

export const actionBarSlot = style({
  '@layer': {
    [app]: {
      'vars': {
        '--at-authoring-action-max-width': 'none'
      },
      '@media': {
        [compactWorkspace]: {
          vars: {
            '--at-authoring-action-max-width': '900px'
          }
        }
      }
    }
  }
})
