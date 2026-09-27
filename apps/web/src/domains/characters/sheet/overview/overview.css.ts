import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const overviewLayout = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '16px',
      minWidth: 0,
      '@media': {
        '(min-width: 1200px)': {
          gridTemplateRows: 'minmax(0, 1fr)',
          height: '100%',
          minHeight: 0
        }
      }
    }
  }
})

export const tabletOverviewGrid = style({
  '@layer': {
    [app]: {
      alignContent: 'start',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr)',
      minHeight: 0,
      minWidth: 0,
      overflowY: 'auto',
      paddingInlineEnd: '4px',
      scrollbarGutter: 'stable'
    }
  }
})

export const abilityStrip = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'repeat(6, minmax(96px, 1fr))',
      minWidth: 0,
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
        },
        '(max-width: 340px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        },
        '(min-width: 761px) and (max-width: 1199px) and (orientation: portrait)': {
          gap: '8px',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))'
        },
        '(min-width: 921px) and (max-width: 1199px) and (orientation: landscape)': {
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))'
        }
      }
    }
  }
})

export const abilityCard = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '80px',
      padding: '8px 10px',
      position: 'relative',
      textAlign: 'center'
    }
  }
})

export const sheetInspectorTrigger = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      color: 'inherit',
      cursor: 'pointer',
      font: 'inherit',
      margin: 0,
      outline: 0,
      width: '100%',
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.recessed,
          borderColor: foundationVars.color.border.strong
        },
        '&:active': {
          background: foundationVars.color.surface.recessed
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus
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
      alignItems: 'center',
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderRadius: foundationVars.radius.sm,
      color: 'inherit',
      cursor: 'pointer',
      display: 'inline-flex',
      font: 'inherit',
      gap: '6px',
      margin: '-4px',
      padding: '4px',
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.recessed
        },
        '&:active': {
          background: foundationVars.color.surface.recessed
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
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
      left: '10px',
      opacity: 0.86,
      position: 'absolute',
      top: '8px',
      '@media': {
        '(min-width: 761px) and (max-width: 1120px)': {
          display: 'none'
        }
      }
    }
  }
})

export const abilityLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.68rem',
      fontWeight: 750,
      letterSpacing: 0,
      lineHeight: 1.2,
      minHeight: '16px',
      width: '100%'
    }
  }
})

export const abilityInspectorTrigger = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderRadius: foundationVars.radius.sm,
      cursor: 'pointer',
      font: 'inherit',
      margin: 0,
      padding: 0,
      position: 'static',
      selectors: {
        '&::after': {
          content: '',
          inset: 0,
          position: 'absolute'
        },
        '&:hover, &:active': {
          background: foundationVars.color.surface.recessed
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        },
        '&:disabled': {
          cursor: 'default'
        }
      }
    }
  }
})

export const abilityModifier = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.2rem',
      fontWeight: 780,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums'
    }
  }
})

export const abilityValues = style({
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      color: foundationVars.color.text.secondary,
      display: 'flex',
      fontVariantNumeric: 'tabular-nums',
      gap: '4px',
      justifyContent: 'center',
      marginTop: '8px',
      position: 'relative',
      zIndex: 1
    }
  }
})

export const abilityScore = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.94rem',
      fontVariantNumeric: 'tabular-nums',
      lineHeight: 1
    }
  }
})

export const playSheetGrid = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(220px, 0.82fr) minmax(300px, 1.08fr)',
      minWidth: 0,
      '@media': {
        '(max-width: 980px)': {
          gridTemplateColumns: 'minmax(220px, 0.86fr) minmax(300px, 1.14fr)'
        },
        '(max-width: 720px)': {
          gridTemplateColumns: '1fr'
        },
        '(min-width: 761px) and (max-width: 1199px) and (orientation: portrait)': {
          gridTemplateColumns: 'minmax(240px, 0.78fr) minmax(0, 1.22fr)'
        },
        '(min-width: 761px) and (max-width: 1199px) and (orientation: landscape)': {
          gridTemplateColumns: 'minmax(240px, 0.72fr) minmax(0, 1.28fr)'
        },
        '(min-width: 1200px)': {
          alignItems: 'stretch',
          gridTemplateColumns: 'minmax(190px, 0.78fr) minmax(260px, 1.22fr)',
          height: '100%',
          minHeight: 0
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
      minHeight: 0,
      minWidth: 0,
      '@media': {
        '(min-width: 1200px)': {
          gridTemplateRows: 'auto auto minmax(0, 1fr)'
        }
      }
    }
  }
})

export const tabletSkillsOnlyGrid = style({
  '@media': {
    '(min-width: 761px) and (max-width: 1199px)': {
      gridTemplateColumns: 'minmax(0, 1fr)'
    }
  }
})

export const tabletHiddenFacts = style({
  '@media': {
    '(min-width: 761px) and (max-width: 1199px)': {
      display: 'none'
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
          gap: '8px',
          padding: '10px'
        }
      }
    }
  }
})

export const overviewPanelHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'flex-start',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between',
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
      display: 'grid',
      gap: '20px'
    }
  }
})

export const hpDeltaRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
    }
  }
})

export const hpReductionList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      listStyle: 'none',
      margin: 0,
      padding: 0
    }
  }
})

export const hpReductionRow = style({
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      paddingBlock: '8px',
      selectors: {
        '&:first-child': {
          paddingBlockStart: 0
        }
      }
    }
  }
})

export const hpReductionRecovery = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.8125rem'
    }
  }
})

export const hpReductionAmount = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 700
    }
  }
})

export const hpSettingsRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      '@media': {
        '(max-width: 48rem)': {
          gridTemplateColumns: '1fr'
        }
      },
      width: '100%'
    }
  }
})
