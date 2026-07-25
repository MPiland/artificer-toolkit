import { globalStyle, keyframes, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const shell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      fontSize: '0.875rem',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr)',
      maxWidth: '100%',
      minWidth: 0,
      width: '100%'
    }
  }
})

export const sheetMobile = style({})
export const sheetTablet = style({})
export const sheetDesktop = style({})

export const desktopSheetCanvas = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(620px, 1.08fr) minmax(430px, 0.92fr)',
      minWidth: 0
    }
  }
})

export const desktopWorkspace = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      minWidth: 0,
      padding: '12px'
    }
  }
})

export const mobileViewTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.35rem',
      fontWeight: 760,
      lineHeight: 1.15,
      margin: 0
    }
  }
})

export const visuallyHidden = style({
  '@layer': {
    [app]: {
      border: 0,
      clip: 'rect(0 0 0 0)',
      height: '1px',
      margin: '-1px',
      overflow: 'hidden',
      padding: 0,
      position: 'absolute',
      whiteSpace: 'nowrap',
      width: '1px'
    }
  }
})

export const sheetTopGrid = style({
  '@layer': {
    [app]: {
      'alignItems': 'stretch',
      'display': 'grid',
      'gap': '12px',
      'gridTemplateColumns': 'minmax(280px, 0.9fr) minmax(0, 1.1fr)',
      'minWidth': 0,
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const sheetAbilityStatusGrid = style({
  '@layer': {
    [app]: {
      'alignItems': 'stretch',
      'display': 'grid',
      'gap': '12px',
      'gridTemplateColumns': 'minmax(520px, 1.12fr) minmax(420px, 0.88fr)',
      'minWidth': 0,
      '@media': {
        '(max-width: 1120px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const tabList = style({
  '@layer': {
    [app]: {
      'flexWrap': 'nowrap',
      'maxWidth': '100%',
      'minWidth': 0,
      'overflowX': 'auto',
      'overflowY': 'hidden',
      'paddingBottom': '4px',
      'scrollbarWidth': 'thin',
      '@media': {
        '(max-width: 760px)': {
          marginInline: '-4px',
          paddingInline: '4px'
        }
      }
    }
  }
})

export const tab = style({
  '@layer': {
    [app]: {
      'flex': '0 0 auto',
      'whiteSpace': 'nowrap',
      '@media': {
        '(max-width: 760px), (pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})

export const hero = style({
  '@layer': {
    [app]: {
      'background': foundationVars.color.surface.panel,
      'border': `1px solid ${foundationVars.color.border.subtle}`,
      'borderRadius': foundationVars.radius.lg,
      'display': 'grid',
      'gap': '12px',
      'gridTemplateColumns': 'minmax(0, 1fr) auto',
      'maxWidth': '100%',
      'minWidth': 0,
      'padding': '12px',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          padding: '14px'
        }
      }
    }
  }
})

export const heroIdentity = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'grid',
      gap: '14px',
      gridTemplateColumns: '76px minmax(0, 1fr)',
      minWidth: 0
    }
  }
})

export const characterMark = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      border: `1px solid ${foundationVars.color.accent.solid}`,
      borderRadius: foundationVars.radius.lg,
      color: foundationVars.color.text.primary,
      display: 'grid',
      height: '76px',
      justifyItems: 'center',
      width: '76px'
    }
  }
})

export const characterMarkIcon = style({
  '@layer': {
    [app]: {
      height: '42px',
      opacity: 0.9,
      width: '42px'
    }
  }
})

export const eyebrow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.68rem',
      fontWeight: 800,
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }
})

export const heroTitle = style({
  '@layer': {
    [app]: {
      'color': foundationVars.color.text.primary,
      'fontSize': '1.48rem',
      'fontWeight': 760,
      'lineHeight': 1.12,
      'margin': 0,
      '@media': {
        '(max-width: 760px)': {
          fontSize: '1.35rem'
        }
      }
    }
  }
})

export const heroMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent,
      fontSize: '0.84rem',
      fontWeight: 700,
      lineHeight: 1.45,
      maxWidth: '70ch'
    }
  }
})

export const heroSubMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.82rem',
      lineHeight: 1.35,
      minHeight: '1.1rem'
    }
  }
})

export const heroIconAction = style({
  '@layer': {
    [app]: {
      alignSelf: 'start',
      minHeight: '44px',
      minWidth: '44px'
    }
  }
})

export const panel = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      display: 'grid',
      gap: '16px',
      padding: '18px'
    }
  }
})

export const panelHeader = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'gap': '12px',
      'justifyContent': 'space-between',
      'alignItems': 'flex-start',
      'flexWrap': 'wrap',
      '@media': {
        '(max-width: 620px)': {
          flexDirection: 'column'
        }
      }
    }
  }
})

export const panelTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1rem',
      fontWeight: 750,
      margin: 0
    }
  }
})

export const muted = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary
    }
  }
})

export const overviewLayout = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '16px',
      minWidth: 0
    }
  }
})

export const overviewHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between',
      minWidth: 0
    }
  }
})

export const overviewTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.35rem',
      fontWeight: 850,
      lineHeight: 1.2,
      margin: 0
    }
  }
})

export const abilityStrip = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '10px',
      'gridTemplateColumns': 'repeat(6, minmax(96px, 1fr))',
      'minWidth': 0,
      '@media': {
        '(max-width: 920px)': {
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
        },
        '(max-width: 520px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        },
        '(max-width: 380px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const abilityCard = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '2px 9px',
      gridTemplateColumns: '30px minmax(0, 1fr) auto',
      gridTemplateRows: 'auto auto auto',
      minHeight: '66px',
      padding: '9px 11px',
      textAlign: 'left'
    }
  }
})

export const sheetInspectorTrigger = style({
  '@layer': {
    [app]: {
      'appearance': 'none',
      'color': 'inherit',
      'cursor': 'pointer',
      'font': 'inherit',
      'margin': 0,
      'outline': 0,
      'width': '100%',
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.subtle,
          borderColor: foundationVars.color.border.strong
        },
        '&:focus-visible': {
          boxShadow: `0 0 0 2px ${foundationVars.color.accent.focus}`
        },
        '&:disabled': {
          cursor: 'default'
        }
      }
    }
  }
})

export const panelHeadingTrigger = style({
  '@layer': {
    [app]: {
      'alignItems': 'center',
      'appearance': 'none',
      'background': 'transparent',
      'border': 0,
      'borderRadius': foundationVars.radius.sm,
      'color': 'inherit',
      'cursor': 'pointer',
      'display': 'inline-flex',
      'font': 'inherit',
      'gap': '6px',
      'margin': '-4px',
      'padding': '4px',
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.subtle
        },
        '&:focus-visible': {
          boxShadow: `0 0 0 2px ${foundationVars.color.accent.focus}`,
          outline: 0
        },
        '&:disabled': {
          cursor: 'default'
        }
      }
    }
  }
})

export const abilityIcon = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      gridColumn: '1',
      gridRow: '1 / span 3',
      opacity: 0.86
    }
  }
})

export const abilityLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.68rem',
      fontWeight: 750,
      gridColumn: '2',
      gridRow: '1',
      letterSpacing: 0,
      lineHeight: 1.2
    }
  }
})

export const abilityModifier = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.52rem',
      fontWeight: 780,
      gridColumn: '3',
      gridRow: '1 / span 2',
      lineHeight: 1
    }
  }
})

export const abilityScore = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      fontSize: '0.74rem',
      fontVariantNumeric: 'tabular-nums',
      gridColumn: '2 / 4',
      gridRow: '3',
      paddingTop: '4px',
      lineHeight: 1.2
    }
  }
})

export const combatPanel = style({
  '@layer': {
    [app]: {
      alignContent: 'center',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(300px, 1.15fr) minmax(180px, 0.85fr)',
      minWidth: 0,
      '@media': {
        '(max-width: 1380px)': {
          gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 0.72fr)'
        },
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        },
        '(min-width: 761px) and (max-width: 1000px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const restActionDock = style({
  '@layer': {
    [app]: {
      'alignContent': 'center',
      'display': 'flex',
      'flexWrap': 'nowrap',
      'gap': '8px',
      'justifyContent': 'flex-end',
      'gridColumn': '1 / -1',
      'minWidth': 'max-content',
      '@media': {
        '(max-width: 1380px)': {
          gridColumn: '1 / -1',
          justifyContent: 'flex-start'
        }
      }
    }
  }
})

export const restActionButton = style({
  '@layer': {
    [app]: {
      minWidth: '108px'
    }
  }
})

export const combatSummaryCard = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      minWidth: 0,
      padding: '12px'
    }
  }
})

export const combatPanelHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'flex',
      justifyContent: 'space-between'
    }
  }
})

export const combatFactGrid = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateColumns': 'repeat(4, minmax(78px, 1fr))',
      'minWidth': 0,
      '@media': {
        '(max-width: 560px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        }
      }
    }
  }
})

export const combatFact = style({
  '@layer': {
    [app]: {
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '3px',
      minWidth: 0,
      padding: '0 14px',
      selectors: {
        '&:last-child': {
          borderInlineEnd: 0
        }
      }
    }
  }
})

export const hpReadout = style({
  '@layer': {
    [app]: {
      'alignContent': 'center',
      'background': foundationVars.color.surface.panel,
      'border': `1px solid ${foundationVars.color.border.subtle}`,
      'borderRadius': foundationVars.radius.lg,
      'display': 'grid',
      'gap': '8px',
      'gridTemplateColumns': '1fr',
      'minWidth': 0,
      'padding': '10px 12px',
      '@media': {
        '(max-width: 700px)': {
          alignItems: 'stretch',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const hpTopLine = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '10px',
      justifyContent: 'space-between',
      minWidth: 0
    }
  }
})

export const hpValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.32rem',
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 780,
      lineHeight: 1
    }
  }
})

export const hpValueSeparator = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '1rem',
      fontWeight: 700,
      paddingInline: '8px'
    }
  }
})

export const hpMeter = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      borderRadius: foundationVars.radius.pill,
      height: '4px',
      overflow: 'hidden',
      width: '100%'
    }
  }
})

export const hpMeterFill = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.status.success,
      display: 'block',
      height: '100%'
    }
  }
})

export const hpMinorFacts = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      display: 'flex',
      fontSize: '0.82rem',
      gap: '12px',
      justifyContent: 'space-between',
      whiteSpace: 'nowrap'
    }
  }
})

export const hpInlineDrawer = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      gridColumn: '1 / -1',
      paddingTop: '12px'
    }
  }
})

export const overviewCoreGrid = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '16px',
      'gridTemplateColumns': 'minmax(0, 1fr) minmax(320px, 0.42fr)',
      'minWidth': 0,
      '@media': {
        '(max-width: 1080px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const playSheetGrid = style({
  '@layer': {
    [app]: {
      'alignItems': 'start',
      'display': 'grid',
      'gap': '12px',
      'gridTemplateColumns': 'minmax(220px, 0.82fr) minmax(300px, 1.08fr) minmax(360px, 1.6fr)',
      'minWidth': 0,
      '@media': {
        '(max-width: 980px)': {
          gridTemplateColumns: 'minmax(220px, 0.86fr) minmax(300px, 1.14fr)'
        },
        '(max-width: 720px)': {
          gridTemplateColumns: '1fr'
        }
      },
      selectors: {
        [`${sheetDesktop} &`]: {
          gridTemplateColumns: 'minmax(190px, 0.78fr) minmax(260px, 1.22fr)'
        }
      }
    }
  }
})

export const overviewLeftRail = style({
  '@layer': {
    [app]: {
      alignContent: 'start',
      display: 'grid',
      gap: '10px',
      minWidth: 0
    }
  }
})

export const playAreaStack = style({
  '@layer': {
    [app]: {
      alignContent: 'start',
      display: 'grid',
      gap: '12px',
      minWidth: 0,
      selectors: {
        [`${sheetDesktop} &`]: {
          display: 'none'
        }
      }
    }
  }
})

export const overviewStack = style({
  '@layer': {
    [app]: {
      alignContent: 'start',
      display: 'grid',
      gap: '16px',
      minWidth: 0
    }
  }
})

export const overviewPanel = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '10px',
      minWidth: 0,
      padding: '12px',
      '@media': {
        '(max-width: 520px)': {
          padding: '14px'
        }
      }
    }
  }
})

export const overviewPanelHeader = style({
  '@layer': {
    [app]: {
      'alignItems': 'flex-start',
      'display': 'flex',
      'gap': '12px',
      'justifyContent': 'space-between',
      '@media': {
        '(max-width: 620px)': {
          flexDirection: 'column'
        }
      }
    }
  }
})

export const metricGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
      minWidth: 0
    }
  }
})

export const metricTile = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      display: 'grid',
      gap: '4px',
      minHeight: '74px',
      padding: '12px'
    }
  }
})

export const metricLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.7rem',
      fontWeight: 700,
      lineHeight: 1.2
    }
  }
})

export const metricValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.12rem',
      fontWeight: 760,
      lineHeight: 1.1
    }
  }
})

export const hpControlGrid = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '10px',
      'gridTemplateColumns': 'repeat(3, minmax(0, 1fr))',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const proficiencyPanel = style([overviewPanel, {
  '@layer': {
    [app]: {
      gap: '8px'
    }
  }
}])

export const proficiencyPanelGrid = style({
  '@layer': {
    [app]: {
      'alignItems': 'start',
      'display': 'grid',
      'gap': '12px',
      'gridTemplateColumns': 'minmax(220px, 0.7fr) minmax(300px, 1fr)',
      'minWidth': 0,
      '@media': {
        '(max-width: 820px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const proficiencyColumns = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '12px',
      'gridTemplateColumns': 'minmax(210px, 0.45fr) minmax(0, 1fr)',
      'minWidth': 0,
      '@media': {
        '(max-width: 900px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const proficiencyColumn = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      minWidth: 0
    }
  }
})

export const proficiencyHeading = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.84rem',
      fontWeight: 750,
      lineHeight: 1.2
    }
  }
})

export const proficiencyList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0
    }
  }
})

export const proficiencyRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: '10px minmax(0, 1fr) minmax(34px, auto)',
      minHeight: '28px',
      minWidth: 0,
      padding: '5px 0',
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const skillRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: '10px minmax(0, 1fr) 42px 46px 46px 50px',
      minHeight: '28px',
      minWidth: 0,
      padding: '4px 0',
      '@media': {
        '(max-width: 560px)': {
          gridTemplateColumns: '10px minmax(0, 1fr) 36px 34px 36px 40px'
        }
      },
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const skillTableHeader = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.muted,
      display: 'grid',
      fontSize: '0.64rem',
      fontWeight: 700,
      gap: '8px',
      gridTemplateColumns: '10px minmax(0, 1fr) 42px 46px 46px 50px',
      letterSpacing: '0.04em',
      padding: '0 0 6px',
      textTransform: 'uppercase',
      '@media': {
        '(max-width: 560px)': {
          gridTemplateColumns: '10px minmax(0, 1fr) 36px 34px 36px 40px'
        }
      }
    }
  }
})

export const proficiencyDot = style({
  '@layer': {
    [app]: {
      background: 'transparent',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.pill,
      display: 'inline-block',
      height: '9px',
      width: '9px',
      selectors: {
        '&[data-proficiency="HALF"]': {
          background: foundationVars.color.accent.soft,
          borderColor: foundationVars.color.accent.border
        },
        '&[data-proficiency="FULL"], &[data-proficiency="DOUBLE"]': {
          background: foundationVars.color.text.accent,
          borderColor: foundationVars.color.text.accent
        }
      }
    }
  }
})

export const proficiencyName = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.76rem',
      fontWeight: 650,
      lineHeight: 1.2
    }
  }
})

export const proficiencyMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.68rem',
      lineHeight: 1.15
    }
  }
})

export const proficiencyBadge = style({
  '@layer': {
    [app]: {
      justifySelf: 'end',
      minWidth: '44px',
      textAlign: 'center'
    }
  }
})

export const proficiencyTotal = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.8rem',
      fontWeight: 750,
      justifySelf: 'end',
      lineHeight: 1
    }
  }
})

export const statusStripPanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      minWidth: 0
    }
  }
})

export const resourceSummaryList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px'
    }
  }
})

export const resourceSummaryRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      padding: '10px'
    }
  }
})

export const statusStrip = style({
  '@layer': {
    [app]: {
      alignItems: 'stretch',
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: 0,
      gridTemplateColumns: 'minmax(112px, 0.9fr) minmax(96px, 0.72fr) minmax(104px, 0.72fr) minmax(164px, 1.2fr)',
      minWidth: 0,
      overflow: 'hidden',
      '@media': {
        '(max-width: 620px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        }
      }
    }
  }
})

export const statusStripItem = style({
  '@layer': {
    [app]: {
      alignContent: 'center',
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '4px',
      minWidth: 0,
      padding: '12px',
      selectors: {
        '&:last-child': {
          borderInlineEnd: 0
        }
      }
    }
  }
})

export const statusStripValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.84rem',
      fontWeight: 750,
      lineHeight: 1.1
    }
  }
})

export const exhaustionPips = style({
  '@layer': {
    [app]: {
      display: 'flex',
      gap: '5px'
    }
  }
})

export const exhaustionPip = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: 'transparent',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.pill,
      cursor: 'pointer',
      height: '10px',
      padding: 0,
      width: '10px',
      selectors: {
        '&[data-active="true"]': {
          background: foundationVars.color.status.warning,
          borderColor: foundationVars.color.status.warning
        },
        '&:disabled': {
          cursor: 'not-allowed',
          opacity: 0.55
        }
      }
    }
  }
})

export const inspirationPip = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      background: 'transparent',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.pill,
      color: foundationVars.color.text.muted,
      cursor: 'pointer',
      display: 'inline-flex',
      height: '24px',
      justifyContent: 'center',
      padding: 0,
      selectors: {
        '&[data-active="true"]': {
          background: foundationVars.color.accent.soft,
          borderColor: foundationVars.color.accent.border,
          color: foundationVars.color.accent.solid
        },
        '&:disabled': {
          cursor: 'not-allowed',
          opacity: 0.55
        }
      },
      width: '24px'
    }
  }
})

export const conditionSummary = style([statusStripItem, {
  '@layer': {
    [app]: {
      borderInlineEnd: 0
    }
  }
}])

export const conditionAddShell = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      appearance: 'none',
      background: 'transparent',
      border: `1px dashed ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.secondary,
      cursor: 'pointer',
      display: 'grid',
      font: 'inherit',
      gap: '8px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      minHeight: '34px',
      minWidth: 0,
      padding: '6px 9px',
      textAlign: 'left',
      width: '100%',
      selectors: {
        '&:disabled': {
          cursor: 'not-allowed',
          opacity: 0.55
        }
      }
    }
  }
})

export const statusControlPanel = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '8px',
      minWidth: 0,
      padding: '10px'
    }
  }
})

export const statusControlGrid = style({
  '@layer': {
    [app]: {
      'alignItems': 'end',
      'display': 'grid',
      'gap': '8px',
      'gridTemplateColumns': 'minmax(160px, 0.85fr) minmax(180px, 1fr) auto',
      'minWidth': 0,
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const statusConditionList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0,
      minWidth: 0
    }
  }
})

export const statusConditionRow = style({
  '@layer': {
    [app]: {
      'alignItems': 'center',
      'borderTop': `1px solid ${foundationVars.color.border.subtle}`,
      'display': 'grid',
      'gap': '8px',
      'gridTemplateColumns': 'minmax(0, 1fr) auto',
      'minHeight': '34px',
      'minWidth': 0,
      'padding': '7px 0',
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const playPanel = style([overviewPanel, {
  '@layer': {
    [app]: {
      gap: '8px'
    }
  }
}])

export const playPanelHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const playTable = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minWidth: 0
    }
  }
})

export const actionSummary = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px',
      minWidth: 0
    }
  }
})

export const actionFilterBar = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
      minWidth: 0
    }
  }
})

export const actionFilterChip = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.secondary,
      cursor: 'pointer',
      font: 'inherit',
      fontSize: '0.64rem',
      fontWeight: 700,
      lineHeight: 1,
      minHeight: '32px',
      padding: '6px 9px',
      textTransform: 'uppercase',
      '@media': {
        '(pointer: coarse)': {
          minHeight: '44px'
        }
      },
      selectors: {
        '&[data-active="true"]': {
          borderColor: foundationVars.color.accent.solid,
          color: foundationVars.color.text.accent
        }
      }
    }
  }
})

export const actionTable = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minWidth: 0
    }
  }
})

export const actionTableHeader = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.muted,
      display: 'grid',
      fontSize: '0.64rem',
      fontWeight: 700,
      gap: '10px',
      gridTemplateColumns: '18px minmax(0, 1fr) minmax(92px, 0.35fr) minmax(120px, 0.55fr)',
      letterSpacing: '0.04em',
      padding: '0 0 6px',
      textTransform: 'uppercase'
    }
  }
})

export const actionTableRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: '18px minmax(0, 1fr) minmax(92px, 0.35fr) minmax(120px, 0.55fr)',
      minHeight: '38px',
      minWidth: 0,
      padding: '7px 0',
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const actionIcon = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.pill,
      color: foundationVars.color.text.accent,
      display: 'grid',
      height: '18px',
      justifyItems: 'center',
      width: '18px'
    }
  }
})

export const actionKindText = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.68rem',
      fontWeight: 700,
      lineHeight: 1.15,
      textTransform: 'capitalize'
    }
  }
})

export const playTableHeader = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.muted,
      display: 'grid',
      fontSize: '0.66rem',
      fontWeight: 700,
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(86px, auto) minmax(96px, auto)',
      letterSpacing: '0.06em',
      padding: '0 0 7px',
      textTransform: 'uppercase'
    }
  }
})

export const playTableRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(86px, auto) minmax(96px, auto)',
      minHeight: '34px',
      minWidth: 0,
      padding: '8px 0'
    }
  }
})

export const playRowTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.78rem',
      fontWeight: 700,
      lineHeight: 1.2
    }
  }
})

export const playRowMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.7rem',
      lineHeight: 1.2
    }
  }
})

export const playBadge = style({
  '@layer': {
    [app]: {
      justifySelf: 'start',
      maxWidth: '120px'
    }
  }
})

export const featureSummary = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      paddingTop: '12px'
    }
  }
})

export const featureSummaryList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px'
    }
  }
})

export const featureSummaryRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px',
      minWidth: 0
    }
  }
})

export const compactDataList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0,
      minWidth: 0
    }
  }
})

export const compactDataRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.secondary,
      display: 'grid',
      fontSize: '0.8rem',
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(80px, auto)',
      minHeight: '28px',
      minWidth: 0,
      padding: '4px 0',
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const resourceOverviewGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0,
      gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))',
      minWidth: 0
    }
  }
})

export const resourceOverviewItem = style({
  '@layer': {
    [app]: {
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '4px',
      minWidth: 0,
      padding: '4px 12px',
      selectors: {
        '&:last-child': {
          borderInlineEnd: 0
        }
      }
    }
  }
})

export const rowList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px'
    }
  }
})

export const row = style({
  '@layer': {
    [app]: {
      'alignItems': 'center',
      'border': `1px solid ${foundationVars.color.border.subtle}`,
      'borderRadius': foundationVars.radius.lg,
      'display': 'grid',
      'gap': '12px',
      'gridTemplateColumns': 'minmax(0, 1fr) auto',
      'padding': '12px',
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const inlineEditorShell = style({
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
    }
  }
})

export const inlineEditor = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px'
    }
  }
})

export const compactActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      justifyContent: 'flex-end'
    }
  }
})

export const compactActionControl = style({
  '@layer': {
    [app]: {
      'minHeight': '34px',
      '@media': {
        '(max-width: 620px), (pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})

export const hpControls = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '12px',
      'gridTemplateColumns': 'repeat(3, minmax(0, 1fr))',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const hpControlTarget = style({
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 760px), (pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})

const mobilePageIn = keyframes({
  from: {
    opacity: 0,
    transform: 'translateX(12px)'
  },
  to: {
    opacity: 1,
    transform: 'translateX(0)'
  }
})

export const mobilePager = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '12px',
      'minWidth': 0,
      'paddingBlockEnd': 'calc(88px + env(safe-area-inset-bottom, 0px))',
      '@media': {
        '(max-width: 640px)': {
          paddingBlockEnd: 'calc(152px + env(safe-area-inset-bottom, 0px))'
        }
      }
    }
  }
})

export const mobilePageLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.05rem',
      fontWeight: 850,
      lineHeight: 1.15,
      paddingInline: '2px'
    }
  }
})

export const mobilePageViewport = style({
  '@layer': {
    [app]: {
      animation: `${mobilePageIn} 180ms ease-out`,
      minWidth: 0,
      touchAction: 'pan-y',
      '@media': {
        '(prefers-reduced-motion: reduce)': {
          animation: 'none'
        }
      }
    }
  }
})

export const mobilePageStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      minWidth: 0
    }
  }
})

export const mobilePageMenu = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '8px',
      'gridTemplateColumns': 'repeat(2, minmax(0, 1fr))',
      'paddingBottom': 'calc(12px + env(safe-area-inset-bottom, 0px))'
    }
  }
})

export const mobilePageMenuItem = style({
  '@layer': {
    [app]: {
      borderRadius: foundationVars.radius.md,
      justifyContent: 'flex-start',
      minHeight: '44px',
      selectors: {
        '&[data-active="true"]': {
          color: foundationVars.color.accent.contrast
        }
      }
    }
  }
})

export const mobileFloatingDock = style({
  '@layer': {
    [app]: {
      'alignItems': 'center',
      'bottom': 'calc(18px + env(safe-area-inset-bottom, 0px))',
      'boxSizing': 'border-box',
      'display': 'flex',
      'justifyContent': 'flex-end',
      'left': '50%',
      'maxWidth': '440px',
      'paddingInline': '18px',
      'pointerEvents': 'none',
      'position': 'fixed',
      'transform': 'translateX(-50%)',
      'width': '100%',
      'zIndex': 49,
      '@media': {
        '(max-width: 640px)': {
          bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))'
        }
      }
    }
  }
})

export const mobileFloatingButton = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.accent.solid,
      borderRadius: foundationVars.radius.pill,
      color: foundationVars.color.accent.contrast,
      minHeight: '48px',
      minWidth: '48px',
      pointerEvents: 'auto',
      selectors: {
        '&:disabled': {
          opacity: 0.45
        }
      }
    }
  }
})

export const sectionHeadingRow = style({
  '@layer': { [app]: { alignItems: 'baseline', display: 'flex', flexWrap: 'wrap', gap: '6px 12px', justifyContent: 'space-between' } }
})

export const spellSlotSection = style({
  '@layer': { [app]: { display: 'grid', gap: '10px' } }
})

export const spellSlotGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'repeat(5, minmax(66px, 1fr))',
      '@media': { '(max-width: 560px)': { gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' } }
    }
  }
})

export const spellSlotCell = style({
  '@layer': {
    [app]: {
      'appearance': 'none',
      'background': foundationVars.color.surface.panel,
      'border': `1px solid ${foundationVars.color.border.subtle}`,
      'borderRadius': foundationVars.radius.md,
      'color': foundationVars.color.text.primary,
      'cursor': 'pointer',
      'display': 'grid',
      'font': 'inherit',
      'gap': '2px',
      'minHeight': '52px',
      'padding': '7px 8px',
      'textAlign': 'center',
      'transition': 'border-color 180ms ease-out, background-color 180ms ease-out',
      'selectors': {
        '&:hover': { borderColor: foundationVars.color.accent.solid },
        '&:focus-visible': { outline: `2px solid ${foundationVars.color.accent.solid}`, outlineOffset: '2px' }
      }
    }
  }
})

export const sheetToolbar = style({
  '@layer': { [app]: { alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between' } }
})

export const filterButtons = style({
  '@layer': { [app]: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }
})

export const scrollableSheetList = style({
  '@layer': { [app]: { maxHeight: 'min(60vh, 720px)', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable' } }
})

export const itemHeadingRow = style({
  '@layer': { [app]: { alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: '8px' } }
})

export const badgeRow = style({
  '@layer': { [app]: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }
})

export const mechanicList = style({
  '@layer': { [app]: { display: 'grid', gap: '8px', marginTop: '8px' } }
})

export const mechanicBlock = style({
  '@layer': { [app]: { display: 'grid', gap: '3px', minWidth: 0 } }
})

export const mechanicFacts = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.76rem',
      lineHeight: 1.35
    }
  }
})

export const mechanicOutcome = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.8rem',
      fontWeight: 650,
      lineHeight: 1.35
    }
  }
})

export const mechanicScaling = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent,
      fontSize: '0.72rem',
      lineHeight: 1.35
    }
  }
})

export const drawerStack = style({
  '@layer': { [app]: { display: 'grid', gap: '16px' } }
})

export const drawerSection = style({
  '@layer': { [app]: { borderTop: `1px solid ${foundationVars.color.border.subtle}`, display: 'grid', gap: '10px', paddingTop: '16px' } }
})

export const inlineControlRow = style({
  '@layer': { [app]: { alignItems: 'end', display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', '@media': { '(max-width: 420px)': { gridTemplateColumns: '1fr' } } } }
})

export const noteViewer = style({
  '@layer': { [app]: { display: 'grid', gap: '24px', minHeight: '360px' } }
})

export const noteHeader = style({
  '@layer': { [app]: { alignItems: 'start', borderBottom: `1px solid ${foundationVars.color.border.subtle}`, display: 'flex', gap: '16px', justifyContent: 'space-between', paddingBottom: '16px' } }
})

export const noteTitle = style({
  '@layer': { [app]: { marginTop: '8px', textWrap: 'balance' } }
})

export const noteBody = style({
  '@layer': { [app]: { maxWidth: '72ch', minHeight: '240px' } }
})

export const sheetEmptyState = style({
  '@layer': { [app]: { alignItems: 'center', display: 'grid', gap: '10px', justifyItems: 'center', minHeight: '320px', padding: '32px', textAlign: 'center' } }
})

export const readOnlyDetails = style({
  '@layer': { [app]: { borderTop: `1px solid ${foundationVars.color.border.subtle}`, paddingTop: '12px' } }
})

export const noteBrowseList = style({
  '@layer': { [app]: { display: 'grid', gap: '4px', maxHeight: '40vh', overflowY: 'auto' } }
})

export const noteBrowseItem = style({
  '@layer': {
    [app]: {
      'alignItems': 'center',
      'appearance': 'none',
      'background': 'transparent',
      'border': 0,
      'borderRadius': foundationVars.radius.md,
      'color': foundationVars.color.text.primary,
      'cursor': 'pointer',
      'display': 'flex',
      'font': 'inherit',
      'justifyContent': 'space-between',
      'padding': '10px',
      'textAlign': 'left',
      'selectors': {
        '&:hover': { background: foundationVars.color.surface.subtle },
        '&:focus-visible': { outline: `2px solid ${foundationVars.color.accent.solid}` }
      }
    }
  }
})

export const groupManagementRow = style({
  '@layer': { [app]: { alignItems: 'center', display: 'flex', gap: '12px', justifyContent: 'space-between', minHeight: '34px' } }
})

export const modalActions = style({
  '@layer': { [app]: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' } }
})

export const inventorySummary = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
    }
  }
})

export const subsectionTabs = style({
  '@layer': { [app]: { flexWrap: 'nowrap', overflowX: 'auto' } }
})

export const containerList = style({
  '@layer': { [app]: { display: 'grid', gap: '12px' } }
})

export const containerSection = style({
  '@layer': { [app]: { border: `1px solid ${foundationVars.color.border.subtle}`, borderRadius: foundationVars.radius.lg, display: 'grid', gap: '8px', padding: '12px' } }
})

export const containerHeading = style({
  '@layer': { [app]: { alignItems: 'center', display: 'flex', gap: '12px', justifyContent: 'space-between' } }
})

export const itemManagementRow = style({
  '@layer': { [app]: { alignItems: 'center', display: 'grid', gap: '10px', gridTemplateColumns: 'minmax(0, 1fr) minmax(140px, 0.75fr)' } }
})

export const groupManagementGrid = style({
  '@layer': { [app]: { display: 'grid', gap: '8px' } }
})

globalStyle(`${spellSlotCell} span`, {
  '@layer': { [app]: { color: foundationVars.color.text.secondary, fontSize: '0.7rem' } }
})

globalStyle(`${spellSlotCell} strong`, {
  '@layer': { [app]: { fontVariantNumeric: 'tabular-nums' } }
})

globalStyle(`${readOnlyDetails} summary`, {
  '@layer': { [app]: { cursor: 'pointer', fontWeight: 700, paddingBlock: '8px' } }
})

globalStyle(`${noteBrowseItem} span`, {
  '@layer': { [app]: { display: 'grid', gap: '2px' } }
})

globalStyle(`${noteBrowseItem} small`, {
  '@layer': { [app]: { color: foundationVars.color.text.secondary } }
})

globalStyle(`${inventorySummary} > div`, {
  '@layer': { [app]: { alignItems: 'center', borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`, display: 'flex', gap: '10px', justifyContent: 'center', padding: '8px' } }
})

globalStyle(`${inventorySummary} > div:last-child`, {
  '@layer': { [app]: { borderInlineEnd: 0 } }
})

globalStyle(`${inventorySummary} span`, {
  '@layer': { [app]: { display: 'grid' } }
})

globalStyle(`${inventorySummary} small`, {
  '@layer': { [app]: { color: foundationVars.color.text.secondary } }
})
