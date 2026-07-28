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

export const sheetMobile = style({
  '@layer': {
    [app]: {
      blockSize: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'hidden'
    }
  }
})
export const sheetTablet = style({})
export const sheetDesktop = style({})

export const desktopSheetCanvas = style({
  '@layer': {
    [app]: {
      alignItems: 'stretch',
      blockSize: '690px',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(620px, 1.08fr) minmax(430px, 0.92fr)',
      minWidth: 0
    }
  }
})

export const tabletLandscapeCanvas = style({
  '@layer': {
    [app]: {
      alignItems: 'stretch',
      blockSize: 'clamp(420px, calc(100dvh - 328px), 520px)',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(300px, 0.8fr) minmax(0, 1.2fr)',
      minHeight: 0,
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
      display: 'grid',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
      padding: '12px'
    }
  }
})

export const desktopWorkspaceTabs = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      height: '100%',
      minHeight: 0
    }
  }
})

export const desktopWorkspacePanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr)',
      minHeight: 0,
      overflow: 'hidden',
      paddingBottom: '12px'
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
      alignItems: 'stretch',
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gridTemplateColumns: 'minmax(300px, 0.82fr) minmax(0, 1.18fr)',
      minWidth: 0,
      overflow: 'hidden',
      '@media': {
        '(max-width: 1000px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const sheetAbilityStatusGrid = style({
  '@layer': {
    [app]: {
      alignItems: 'stretch',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(520px, 1.12fr) minmax(420px, 0.88fr)',
      minWidth: 0,
      '@media': {
        '(max-width: 1120px)': {
          gridTemplateColumns: '1fr'
        },
        '(min-width: 960px) and (max-width: 1199px) and (orientation: landscape)': {
          gridTemplateColumns: 'minmax(500px, 1.12fr) minmax(400px, 0.88fr)'
        }
      }
    }
  }
})

export const tabList = style({
  '@layer': {
    [app]: {
      flexWrap: 'nowrap',
      maxWidth: '100%',
      minWidth: 0,
      overflowX: 'auto',
      overflowY: 'visible',
      paddingBottom: '4px',
      scrollbarWidth: 'thin',
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
      backgroundColor: 'transparent',
      flex: '0 0 auto',
      whiteSpace: 'nowrap',
      '@media': {
        '(max-width: 760px), (pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})

globalStyle(`${tab}:hover, ${tab}[data-active="true"]`, {
  '@layer': {
    [app]: {
      backgroundColor: 'transparent',
      borderColor: 'transparent'
    }
  }
})

globalStyle(`${tab}[data-active="true"]`, {
  '@layer': {
    [app]: {
      borderBottomColor: foundationVars.color.accent.solid
    }
  }
})

globalStyle(`${tab}:focus-visible`, {
  '@layer': {
    [app]: {
      boxShadow: foundationVars.shadow.focus,
      outline: 'none !important'
    }
  }
})

export const hero = style({
  '@layer': {
    [app]: {
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      maxWidth: '100%',
      minWidth: 0,
      padding: '10px 14px',
      '@media': {
        '(max-width: 1000px)': {
          borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
          borderInlineEnd: 0
        },
        '(max-width: 760px)': {
          alignItems: 'center',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: '8px',
          padding: '8px 10px'
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
      gap: '12px',
      gridTemplateColumns: '64px minmax(0, 1fr)',
      minWidth: 0,
      '@media': {
        '(max-width: 760px)': {
          gap: '10px',
          gridTemplateColumns: '44px minmax(0, 1fr)'
        }
      }
    }
  }
})

export const heroIdentityCopy = style({
  '@layer': {
    [app]: {
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
      height: '64px',
      justifyItems: 'center',
      width: '64px',
      '@media': {
        '(max-width: 760px)': {
          borderRadius: foundationVars.radius.md,
          height: '44px',
          width: '44px'
        }
      }
    }
  }
})

export const characterMarkIcon = style({
  '@layer': {
    [app]: {
      height: '34px',
      opacity: 0.9,
      width: '34px',
      '@media': {
        '(max-width: 760px)': {
          height: '24px',
          width: '24px'
        }
      }
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
      textTransform: 'uppercase',
      '@media': {
        '(max-width: 760px)': {
          display: 'none'
        }
      }
    }
  }
})

export const heroTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.48rem',
      fontWeight: 760,
      lineHeight: 1.12,
      margin: 0,
      '@media': {
        '(max-width: 760px)': {
          fontSize: '1.08rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
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
      maxWidth: '70ch',
      '@media': {
        '(max-width: 760px)': {
          fontSize: '0.74rem',
          lineHeight: 1.25,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }
      }
    }
  }
})

export const heroClassLine = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px'
    }
  }
})

export const heroSubMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.82rem',
      lineHeight: 1.35,
      minHeight: '1.1rem',
      '@media': {
        '(max-width: 760px)': {
          display: 'none'
        }
      }
    }
  }
})

export const heroIconAction = style({
  '@layer': {
    [app]: {
      alignSelf: 'start',
      minHeight: '44px',
      minWidth: '44px',
      '@media': {
        '(max-width: 760px)': {
          alignSelf: 'center'
        }
      }
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
      padding: '18px',
      selectors: {
        [`${desktopWorkspacePanel} > &`]: {
          alignContent: 'start',
          boxSizing: 'border-box',
          height: '100%',
          minHeight: 0,
          overflowY: 'auto',
          paddingInlineEnd: '8px',
          scrollbarGutter: 'stable',
          scrollbarWidth: 'thin'
        }
      }
    }
  }
})

globalStyle(`${desktopWorkspacePanel} > ${panel}::-webkit-scrollbar`, {
  width: '6px'
})

globalStyle(`${desktopWorkspacePanel} > ${panel}::-webkit-scrollbar-track`, {
  background: 'transparent'
})

globalStyle(`${desktopWorkspacePanel} > ${panel}::-webkit-scrollbar-thumb`, {
  background: foundationVars.color.accent.border,
  borderRadius: foundationVars.radius.pill
})

export const panelHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
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
      minWidth: 0,
      selectors: {
        [`${sheetDesktop} &`]: {
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
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      minHeight: 0,
      minWidth: 0,
      overflowY: 'auto',
      paddingInlineEnd: '4px',
      scrollbarGutter: 'stable'
    }
  }
})

globalStyle(`${tabletOverviewGrid} > :first-child, ${tabletOverviewGrid} > :last-child`, {
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
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
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'repeat(6, minmax(96px, 1fr))',
      minWidth: 0,
      '@media': {
        '(max-width: 920px)': {
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
        },
        '(max-width: 520px)': {
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
        },
        '(max-width: 340px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        },
        '(min-width: 761px) and (max-width: 1199px) and (orientation: portrait)': {
          gap: '8px',
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
      minHeight: '92px',
      padding: '10px 12px 9px',
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
          background: foundationVars.color.surface.subtle,
          borderColor: foundationVars.color.border.strong
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
          background: foundationVars.color.surface.subtle
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
      top: '10px'
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

export const abilityModifier = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.52rem',
      fontWeight: 780,
      lineHeight: 1,
      margin: 'auto 0',
      width: '100%'
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
      paddingTop: '4px',
      lineHeight: 1.2,
      width: '100%'
    }
  }
})

export const combatPanel = style({
  '@layer': {
    [app]: {
      alignContent: 'center',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(300px, 1fr) minmax(260px, 0.72fr)',
      minWidth: 0,
      padding: '12px 14px',
      '@media': {
        '(max-width: 1380px)': {
          gridTemplateColumns: 'minmax(280px, 1fr) minmax(240px, 0.78fr)'
        },
        '(max-width: 760px)': {
          gap: '6px',
          gridTemplateColumns: '1fr',
          padding: '8px 10px'
        }
      }
    }
  }
})

export const restActionDock = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '6px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      minWidth: 0
    }
  }
})

export const restActionButton = style({
  '@layer': {
    [app]: {
      minWidth: 0,
      paddingInline: '8px',
      '@media': {
        '(min-width: 761px) and (max-width: 1280px)': {
          paddingInline: '4px'
        }
      }
    }
  }
})

export const restActionIcon = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'inline-flex',
      '@media': {
        '(min-width: 761px) and (max-width: 1280px)': {
          display: 'none'
        }
      }
    }
  }
})

export const combatSummaryCard = style({
  '@layer': {
    [app]: {
      alignContent: 'center',
      alignItems: 'center',
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      minWidth: 0,
      padding: '4px 14px 4px 0',
      '@media': {
        '(max-width: 760px)': {
          borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
          borderInlineEnd: 0,
          padding: '0 0 6px'
        }
      }
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
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(78px, 1fr))',
      minWidth: 0,
      '@media': {
        '(max-width: 560px)': {
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'
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
      padding: '4px 12px',
      '@media': {
        '(max-width: 560px)': {
          gap: '2px',
          padding: '2px 4px',
          textAlign: 'center'
        }
      },
      selectors: {
        '&:last-child': {
          borderInlineEnd: 0
        }
      }
    }
  }
})

export const desktopDefenseSummary = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '6px',
      padding: '8px 12px 0'
    }
  }
})

export const desktopDefenseGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      minWidth: 0
    }
  }
})

export const desktopDefenseGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px',
      minWidth: 0
    }
  }
})

export const desktopDefenseValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.76rem',
      fontWeight: 700,
      lineHeight: 1.25,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const combatFactDesktopLabel = style({
  '@layer': {
    [app]: {
      display: 'inline',
      '@media': {
        '(max-width: 560px)': {
          display: 'none'
        }
      }
    }
  }
})

export const combatFactMobileLabel = style({
  '@layer': {
    [app]: {
      display: 'none',
      '@media': {
        '(max-width: 560px)': {
          display: 'inline'
        }
      }
    }
  }
})

export const combatFactButton = style({
  '@layer': {
    [app]: {
      background: 'transparent',
      borderBlock: 0,
      borderInlineStart: 0,
      borderRadius: foundationVars.radius.sm,
      textAlign: 'left',
      '@media': {
        '(max-width: 560px)': {
          textAlign: 'center'
        }
      }
    }
  }
})

export const hpReadout = style({
  '@layer': {
    [app]: {
      alignContent: 'center',
      display: 'grid',
      columnGap: '12px',
      gridTemplateAreas: '"top minor" "actions actions"',
      gridTemplateColumns: 'minmax(104px, 0.72fr) minmax(0, 1.28fr)',
      minWidth: 0,
      padding: '4px 0',
      rowGap: '10px',
      '@media': {
        '(max-width: 700px)': {
          alignItems: 'center',
          columnGap: '8px',
          gridTemplateAreas: '"top minor actions"',
          gridTemplateColumns: 'minmax(76px, 0.82fr) minmax(118px, 1.38fr) minmax(74px, 0.8fr)',
          padding: '2px 0'
        },
        '(max-width: 340px)': {
          columnGap: '4px',
          gridTemplateColumns: 'minmax(68px, 0.78fr) minmax(108px, 1.34fr) minmax(68px, 0.74fr)'
        }
      }
    }
  }
})

export const hpTopLine = style({
  '@layer': {
    [app]: {
      alignItems: 'flex-start',
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      gridArea: 'top',
      justifyContent: 'center',
      minWidth: 0,
      paddingInlineEnd: '12px',
      '@media': {
        '(max-width: 700px)': {
          alignItems: 'center',
          alignSelf: 'stretch',
          paddingInlineEnd: '8px',
          textAlign: 'center'
        }
      }
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
      paddingInline: '6px',
      '@media': {
        '(max-width: 700px)': {
          paddingInline: '4px'
        }
      }
    }
  }
})

export const hpMinorFacts = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      display: 'grid',
      fontSize: '0.82rem',
      gridArea: 'minor',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      minWidth: 0,
      whiteSpace: 'nowrap',
      '@media': {
        '(max-width: 700px)': {
          alignSelf: 'stretch'
        }
      }
    }
  }
})

export const hpMinorFact = style({
  '@layer': {
    [app]: {
      alignContent: 'center',
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '3px',
      justifyItems: 'center',
      minWidth: 0,
      paddingInline: '8px',
      textAlign: 'center',
      selectors: {
        '&:last-child': {
          borderInlineEnd: 0
        }
      },
      '@media': {
        '(max-width: 340px)': {
          paddingInline: '4px'
        }
      }
    }
  }
})

export const hpMinorValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.94rem',
      fontVariantNumeric: 'tabular-nums',
      lineHeight: 1.1
    }
  }
})

export const hpHitDiceValue = style({
  '@layer': {
    [app]: {
      whiteSpace: 'normal',
      '@media': {
        '(max-width: 700px)': {
          fontSize: '0.78rem',
          lineHeight: 1.05
        }
      }
    }
  }
})

export const hpActionCluster = style({
  '@layer': {
    [app]: {
      alignItems: 'stretch',
      display: 'grid',
      gap: '6px',
      gridArea: 'actions',
      gridTemplateColumns: 'minmax(86px, 0.8fr) minmax(164px, 1.4fr)',
      minWidth: 0,
      '@media': {
        '(max-width: 520px)': {
          alignSelf: 'center',
          gridArea: 'actions',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const hpManageButton = style({
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 520px)': {
          paddingInline: '6px'
        }
      }
    }
  }
})

export const hpManageLabel = style({
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 520px)': {
          fontSize: 0,
          selectors: {
            '&::after': {
              content: '"Manage"',
              fontSize: '0.74rem'
            }
          }
        }
      }
    }
  }
})

export const hpManagementPopover = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.canvas,
      borderColor: foundationVars.color.border.subtle,
      display: 'grid',
      gap: '16px',
      padding: '16px'
    }
  }
})

export const hpManagementPopoverHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const hpManagementPopoverTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.95rem',
      fontWeight: 760
    }
  }
})

export const hpManagementDrawerBody = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '20px',
      padding: '20px'
    }
  }
})

export const overviewCoreGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '16px',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.42fr)',
      minWidth: 0,
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
      alignItems: 'start',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(220px, 0.82fr) minmax(300px, 1.08fr) minmax(360px, 1.6fr)',
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
          gridTemplateColumns: 'minmax(270px, 0.72fr) minmax(0, 1.28fr)'
        }
      },
      selectors: {
        [`${sheetDesktop} &`]: {
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
      selectors: {
        [`${sheetDesktop} &`]: {
          gridTemplateRows: 'auto auto minmax(0, 1fr)'
        }
      }
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
      '@media': {
        '(min-width: 761px) and (max-width: 1199px)': {
          display: 'none'
        }
      },
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

export const hpSettingsRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      width: '100%'
    }
  }
})

export const proficiencyPanel = style([
  overviewPanel,
  {
    '@layer': {
      [app]: {
        gap: '8px'
      }
    }
  }
])

export const savingThrowsPanel = style({
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 520px)': {
          padding: '10px'
        }
      }
    }
  }
})

export const skillsPanel = style({
  '@layer': {
    [app]: {
      '@media': {
        '(min-width: 960px) and (max-width: 1199px) and (orientation: landscape)': {
          gridTemplateRows: 'auto minmax(0, 1fr)',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden'
        }
      },
      selectors: {
        [`${sheetDesktop} &`]: {
          gridTemplateRows: 'auto minmax(0, 1fr)',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden'
        }
      }
    }
  }
})

export const skillsList = style({
  '@layer': {
    [app]: {
      '@media': {
        '(min-width: 960px) and (max-width: 1199px) and (orientation: landscape)': {
          minHeight: 0,
          overflowY: 'auto',
          paddingBlockEnd: '12px',
          paddingInlineEnd: '4px',
          scrollbarGutter: 'stable'
        }
      },
      selectors: {
        [`${sheetDesktop} &`]: {
          minHeight: 0,
          overflowY: 'auto',
          paddingBlockEnd: '12px',
          paddingInlineEnd: '4px',
          scrollbarGutter: 'stable'
        }
      }
    }
  }
})

export const proficiencySummaryPanel = style({
  '@layer': {
    [app]: {
      selectors: {
        [`${sheetDesktop} &`]: {
          gridTemplateRows: 'auto minmax(0, 1fr)',
          minHeight: 0,
          overflow: 'hidden'
        }
      }
    }
  }
})

export const proficiencySummaryList = style({
  '@layer': {
    [app]: {
      alignContent: 'start',
      display: 'grid',
      gap: 0,
      selectors: {
        [`${sheetDesktop} &`]: {
          minHeight: 0,
          overflowY: 'auto',
          paddingInlineEnd: '4px',
          scrollbarGutter: 'stable',
          scrollbarWidth: 'thin'
        }
      }
    }
  }
})

globalStyle(`${proficiencySummaryList}::-webkit-scrollbar`, {
  width: '6px'
})

globalStyle(`${proficiencySummaryList}::-webkit-scrollbar-track`, {
  background: foundationVars.color.surface.recessed,
  borderRadius: foundationVars.radius.pill
})

globalStyle(`${proficiencySummaryList}::-webkit-scrollbar-thumb`, {
  background: foundationVars.color.accent.border,
  borderRadius: foundationVars.radius.pill
})

export const proficiencySummaryGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px',
      selectors: {
        '&:not(:first-child)': {
          borderTop: `1px solid ${foundationVars.color.border.subtle}`,
          marginTop: '10px',
          paddingTop: '8px'
        }
      }
    }
  }
})

export const proficiencySummaryValues = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.8rem',
      lineHeight: 1.35
    }
  }
})

export const proficiencyPanelGrid = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(220px, 0.7fr) minmax(300px, 1fr)',
      minWidth: 0,
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
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(210px, 0.45fr) minmax(0, 1fr)',
      minWidth: 0,
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
      background: 'transparent',
      borderLeft: 0,
      borderRight: 0,
      borderTop: 0,
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

export const savingThrowsList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
    }
  }
})

export const savingThrowCard = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      color: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      font: 'inherit',
      gap: '5px',
      minHeight: '58px',
      minWidth: 0,
      padding: '7px 8px 8px',
      textAlign: 'center'
    }
  }
})

export const savingThrowCardHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      width: '100%'
    }
  }
})

export const savingThrowMarkerSpacer = style({
  '@layer': {
    [app]: {
      flex: '0 0 9px',
      height: '9px',
      width: '9px'
    }
  }
})

export const savingThrowCardLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      flex: 1,
      fontSize: '0.64rem',
      fontWeight: 750,
      lineHeight: 1.2,
      minWidth: 0,
      textAlign: 'center'
    }
  }
})

export const savingThrowCardValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.08rem',
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 780,
      lineHeight: 1,
      margin: 'auto 0',
      width: '100%'
    }
  }
})

export const skillRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      background: 'transparent',
      borderLeft: 0,
      borderRight: 0,
      borderTop: 0,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'minmax(0, 1fr) 42px 46px 46px 50px',
      minHeight: '28px',
      minWidth: 0,
      padding: '4px 0',
      '@media': {
        '(max-width: 560px)': {
          gridTemplateColumns: 'minmax(0, 1fr) 36px 34px 36px 40px'
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
      gridTemplateColumns: 'minmax(0, 1fr) 42px 46px 46px 50px',
      letterSpacing: '0.04em',
      padding: '0 0 6px',
      textTransform: 'uppercase',
      '@media': {
        '(max-width: 560px)': {
          gridTemplateColumns: 'minmax(0, 1fr) 36px 34px 36px 40px'
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
          background: `linear-gradient(90deg, ${foundationVars.color.text.accent} 50%, transparent 50%)`,
          borderColor: foundationVars.color.accent.border
        },
        '&[data-proficiency="FULL"]': {
          background: foundationVars.color.text.accent,
          borderColor: foundationVars.color.text.accent
        },
        '&[data-proficiency="DOUBLE"]': {
          background: foundationVars.color.text.accent,
          borderColor: foundationVars.color.text.accent,
          outline: `1px solid ${foundationVars.color.accent.border}`,
          outlineOffset: '2px'
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

export const mobileStatusBar = style({
  '@layer': {
    [app]: {
      alignItems: 'stretch',
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gridColumn: '1 / -1',
      gridTemplateColumns: 'minmax(86px, 0.8fr) minmax(0, 1.4fr) minmax(82px, auto)',
      minWidth: 0,
      padding: '0 10px'
    }
  }
})

export const mobileStatusItem = style({
  '@layer': {
    [app]: {
      alignContent: 'center',
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '2px',
      minHeight: '42px',
      minWidth: 0,
      padding: '5px 8px',
      selectors: {
        '&:last-child': {
          borderInlineEnd: 0
        }
      }
    }
  }
})

export const mobileStatusAction = style([
  mobileStatusItem,
  {
    '@layer': {
      [app]: {
        appearance: 'none',
        background: 'transparent',
        borderBlock: 0,
        borderInlineStart: 0,
        color: 'inherit',
        cursor: 'pointer',
        font: 'inherit',
        textAlign: 'left',
        width: '100%',
        selectors: {
          '&:hover': {
            background: foundationVars.color.surface.subtle
          },
          '&:focus-visible': {
            boxShadow: foundationVars.shadow.focus,
            outline: 0
          },
          '&:disabled': {
            cursor: 'default',
            opacity: 0.55
          }
        }
      }
    }
  }
])

export const mobileStatusValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.72rem',
      fontWeight: 750,
      lineHeight: 1.1,
      minWidth: 0
    }
  }
})

export const mobileInspirationButton = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.secondary,
      cursor: 'pointer',
      display: 'flex',
      font: 'inherit',
      fontSize: '0.7rem',
      fontWeight: 750,
      gap: '4px',
      minWidth: 0,
      padding: 0,
      selectors: {
        '&[data-active="true"]': {
          color: foundationVars.color.text.accent
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        },
        '&:disabled': {
          cursor: 'not-allowed',
          opacity: 0.55
        }
      }
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
      gridTemplateColumns: 'minmax(112px, 0.9fr) minmax(96px, 0.72fr) minmax(164px, 1.2fr)',
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

export const conditionsOnlyStrip = style({
  '@layer': {
    [app]: {
      gridTemplateColumns: 'minmax(120px, 0.8fr) minmax(0, 1.2fr)'
    }
  }
})

export const statusStripItem = style({
  '@layer': {
    [app]: {
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'flex',
      flexDirection: 'column',
      minHeight: '92px',
      minWidth: 0,
      padding: '10px 12px 9px',
      selectors: {
        '&:last-child': {
          borderInlineEnd: 0
        }
      }
    }
  }
})

export const statusStripLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.68rem',
      fontWeight: 750,
      lineHeight: 1.2,
      minHeight: '16px',
      textAlign: 'center',
      width: '100%'
    }
  }
})

export const statusStripContent = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      minHeight: 0,
      width: '100%'
    }
  }
})

export const statusStripContentStart = style({
  '@layer': {
    [app]: {
      justifyContent: 'flex-start'
    }
  }
})

export const statusStripContentCenter = style({
  '@layer': {
    [app]: {
      justifyContent: 'center',
      textAlign: 'center'
    }
  }
})

export const statusStripStack = style({
  '@layer': {
    [app]: {
      alignItems: 'flex-start',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      minWidth: 0
    }
  }
})

export const statusStripCenteredStack = style({
  '@layer': {
    [app]: {
      alignItems: 'center'
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

export const conditionSummary = style([
  statusStripItem,
  {
    '@layer': {
      [app]: {
        borderInlineEnd: 0
      }
    }
  }
])

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
      alignItems: 'end',
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'minmax(160px, 0.85fr) minmax(180px, 1fr) auto',
      minWidth: 0,
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
      alignItems: 'center',
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      minHeight: '34px',
      minWidth: 0,
      padding: '7px 0',
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const playPanel = style([
  overviewPanel,
  {
    '@layer': {
      [app]: {
        gap: '8px'
      }
    }
  }
])

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
      minWidth: 0,
      '@media': {
        '(max-width: 620px)': {
          flexWrap: 'nowrap',
          overflowX: 'auto',
          paddingBottom: '3px',
          scrollbarWidth: 'thin'
        }
      }
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
      flexShrink: 0,
      font: 'inherit',
      fontSize: foundationVars.typography.label.fontSize,
      fontWeight: foundationVars.typography.label.fontWeight,
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

export const actionCompactList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '14px'
    }
  }
})

export const actionGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minWidth: 0
    }
  }
})

export const actionGroupTitle = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.accent,
      fontSize: '0.74rem',
      letterSpacing: '0.03em',
      margin: 0,
      padding: '3px 8px 6px',
      textTransform: 'uppercase'
    }
  }
})

export const actionGroupRows = style({
  '@layer': { [app]: { display: 'grid', minWidth: 0 } }
})

export const actionDataHeader = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      display: 'grid',
      fontSize: '0.6rem',
      fontWeight: 700,
      gap: '8px',
      letterSpacing: '0.035em',
      padding: '7px 8px 5px',
      textTransform: 'uppercase',
      '@media': {
        '(max-width: 620px)': {
          fontSize: '0.54rem',
          gap: '6px',
          padding: '5px 6px 4px'
        }
      }
    }
  }
})

globalStyle(`${actionDataHeader} > span`, {
  '@layer': {
    [app]: {
      minWidth: 0,
      textAlign: 'center'
    }
  }
})

globalStyle(`${actionDataHeader} > span:first-child`, {
  '@layer': {
    [app]: {
      textAlign: 'left'
    }
  }
})

export const actionDataRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      minHeight: '40px',
      minWidth: 0,
      padding: '5px 8px',
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'center',
          gap: '6px',
          minHeight: '44px',
          padding: '4px 6px'
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

export const actionAttackColumns = style({
  '@layer': {
    [app]: {
      gridTemplateColumns: 'minmax(160px, 1fr) 72px 72px minmax(128px, 0.78fr)',
      '@media': {
        '(max-width: 620px)': {
          gridTemplateColumns: 'minmax(84px, 1.15fr) 44px 44px minmax(72px, 0.9fr)'
        }
      }
    }
  }
})

export const actionDescriptionRow = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '4px',
      minWidth: 0,
      padding: '7px 8px',
      selectors: {
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const actionDescriptionHeading = style({
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

export const actionDescriptionIdentity = style({
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      display: 'flex',
      flex: '1 1 auto',
      flexWrap: 'wrap',
      gap: '2px 5px',
      minWidth: 0
    }
  }
})

export const actionSpecialLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.66rem',
      fontWeight: 650
    }
  }
})

export const actionDescriptionUses = style({
  '@layer': {
    [app]: {
      flex: '0 0 auto'
    }
  }
})

export const actionDescriptionText = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.72rem',
      lineHeight: 1.35,
      margin: 0,
      maxWidth: '72ch'
    }
  }
})

export const actionRowIdentity = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '2px',
      gridColumn: '1',
      minWidth: 0
    }
  }
})

export const actionCompactSource = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.66rem',
      lineHeight: 1.2,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      '@media': {
        '(max-width: 620px)': {
          fontSize: '0.6rem'
        }
      }
    }
  }
})

export const actionIdentityButton = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      font: 'inherit',
      fontWeight: 700,
      minWidth: 0,
      padding: 0,
      textAlign: 'left',
      selectors: {
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        }
      }
    }
  }
})

export const actionDataCell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '1px',
      justifyItems: 'center',
      minWidth: 0,
      overflow: 'hidden',
      textAlign: 'center'
    }
  }
})

globalStyle(`${actionDataCell} > strong`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.72rem',
      fontWeight: 650,
      lineHeight: 1.2,
      maxWidth: '100%',
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      width: '100%',
      whiteSpace: 'nowrap',
      '@media': {
        '(max-width: 620px)': {
          overflowWrap: 'anywhere',
          textOverflow: 'clip',
          whiteSpace: 'normal'
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
      gridTemplateColumns:
        '18px minmax(110px, 1fr) minmax(48px, 0.28fr) minmax(54px, 0.3fr) minmax(110px, 0.75fr)',
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
      gridTemplateColumns:
        '18px minmax(110px, 1fr) minmax(48px, 0.28fr) minmax(54px, 0.3fr) minmax(110px, 0.75fr)',
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

export const rowList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0
    }
  }
})

export const row = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      padding: '10px 0',
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          gridTemplateColumns: '1fr'
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
      minHeight: '34px',
      '@media': {
        '(max-width: 620px), (pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})

export const resourceStepper = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'grid',
      flexShrink: 0,
      gap: '4px',
      gridTemplateColumns: '30px minmax(44px, auto) 30px',
      minWidth: 0,
      '@media': {
        '(max-width: 620px), (pointer: coarse)': {
          gridTemplateColumns: '44px minmax(44px, auto) 44px'
        }
      }
    }
  }
})

export const resourceStepButton = style({
  '@layer': {
    [app]: {
      height: '30px',
      minHeight: '30px',
      minWidth: '30px',
      padding: 0,
      width: '30px',
      '@media': {
        '(max-width: 620px), (pointer: coarse)': {
          height: '34px',
          minHeight: '34px',
          minWidth: '34px',
          width: '34px'
        }
      },
      selectors: {
        '&:disabled': {
          background: 'transparent',
          borderColor: foundationVars.color.border.subtle,
          color: foundationVars.color.text.muted,
          opacity: 0.45
        }
      }
    }
  }
})

export const resourceStepValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.78rem',
      fontVariantNumeric: 'tabular-nums',
      minWidth: '44px',
      textAlign: 'center'
    }
  }
})

export const commandInlineError = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.danger,
      fontSize: '0.76rem',
      lineHeight: 1.35
    }
  }
})

export const hpControlTarget = style({
  '@layer': {
    [app]: {
      minHeight: '40px',
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
      display: 'grid',
      flex: '1 1 0',
      gap: '12px',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden',
      position: 'relative'
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
      boxSizing: 'border-box',
      minHeight: 0,
      minWidth: 0,
      overflowY: 'auto',
      paddingBlockEnd: '72px',
      scrollbarWidth: 'none',
      touchAction: 'pan-y',
      '@media': {
        '(prefers-reduced-motion: reduce)': {
          animation: 'none'
        }
      }
    }
  }
})

globalStyle(`${mobilePageViewport}::-webkit-scrollbar`, {
  display: 'none'
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
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))'
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
      alignItems: 'center',
      bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
      boxSizing: 'border-box',
      display: 'flex',
      insetInline: 0,
      justifyContent: 'flex-end',
      paddingInline: '18px',
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 2
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
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px 12px',
      justifyContent: 'space-between'
    }
  }
})

export const spellCastingSummary = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flex: '1 1 auto',
      flexWrap: 'wrap',
      gap: '8px 20px',
      minHeight: '28px',
      minWidth: 0,
      '@media': {
        '(max-width: 760px)': {
          gap: '6px 14px'
        }
      }
    }
  }
})

export const spellSummaryRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between',
      minWidth: 0
    }
  }
})

globalStyle(`${spellCastingSummary} > span`, {
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      display: 'inline-flex',
      gap: '6px'
    }
  }
})

globalStyle(`${spellCastingSummary} small`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.64rem',
      fontWeight: 700,
      textTransform: 'uppercase'
    }
  }
})

export const spellSlotSection = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '10px',
      minWidth: 0
    }
  }
})

export const spellSlotHeading = style({
  '@layer': {
    [app]: {
      flex: '0 0 auto',
      fontSize: '0.78rem'
    }
  }
})

export const spellSlotGrid = style({
  '@layer': {
    [app]: {
      display: 'flex',
      gap: '6px',
      minWidth: 0,
      overflowX: 'auto',
      padding: '2px',
      scrollbarWidth: 'thin'
    }
  }
})

export const spellSlotCell = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      display: 'inline-flex',
      flex: '0 0 auto',
      font: 'inherit',
      gap: '5px',
      alignItems: 'baseline',
      minHeight: '34px',
      padding: '4px 8px',
      textAlign: 'center',
      transition: 'border-color 180ms ease-out, background-color 180ms ease-out',
      '@media': {
        '(pointer: coarse)': {
          minHeight: '44px',
          paddingInline: '10px'
        }
      },
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.subtle,
          borderColor: foundationVars.color.accent.solid
        },
        '&:focus-visible': {
          outline: `2px solid ${foundationVars.color.accent.solid}`,
          outlineOffset: '2px'
        }
      }
    }
  }
})

export const sheetToolbar = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      justifyContent: 'space-between'
    }
  }
})

export const spellSearch = style({
  '@layer': {
    [app]: {
      maxWidth: '320px',
      width: '100%',
      '@media': {
        '(max-width: 760px)': {
          maxWidth: 'none'
        }
      }
    }
  }
})

export const filterButtons = style({
  '@layer': { [app]: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }
})

export const scrollableSheetList = style({
  '@layer': {
    [app]: {
      maxHeight: 'min(60vh, 720px)',
      maxWidth: '100%',
      minWidth: 0,
      overflowX: 'hidden',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      scrollbarGutter: 'stable',
      '@media': {
        '(max-width: 760px)': {
          maxHeight: 'none',
          overflowX: 'visible',
          overflowY: 'visible',
          scrollbarGutter: 'auto'
        }
      }
    }
  }
})

export const spellGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0,
      selectors: {
        '& + &': {
          marginTop: foundationVars.space[3]
        }
      }
    }
  }
})

export const spellGroupTitle = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.secondary,
      fontSize: '0.76rem',
      padding: '4px 8px 6px'
    }
  }
})

export const spellList = style({
  '@layer': {
    [app]: {
      display: 'grid'
    }
  }
})

export const spellTableHeader = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      display: 'grid',
      fontSize: '0.6rem',
      fontWeight: 700,
      gap: '8px',
      gridTemplateColumns: 'minmax(132px, 1.15fr) 58px 66px 74px minmax(108px, 0.82fr) 50px',
      letterSpacing: '0.035em',
      padding: '7px 8px 5px',
      textTransform: 'uppercase',
      boxSizing: 'border-box',
      width: '100%',
      '@media': {
        '(max-width: 700px)': {
          fontSize: '0.54rem',
          gap: '3px',
          gridTemplateColumns: 'minmax(66px, 1.2fr) 44px 40px 40px minmax(58px, 0.9fr) 50px',
          padding: '5px 4px 3px'
        },
        '(max-width: 360px)': {
          gridTemplateColumns: 'minmax(60px, 1fr) 34px 34px minmax(42px, 0.8fr) 40px'
        }
      }
    }
  }
})

globalStyle(`${spellTableHeader} > span`, {
  '@layer': { [app]: { textAlign: 'center' } }
})

globalStyle(`${spellTableHeader} > span:first-child`, {
  '@layer': { [app]: { textAlign: 'left' } }
})

globalStyle(`${spellTableHeader} > span:nth-child(2)`, {
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 360px)': {
          display: 'none'
        }
      }
    }
  }
})

export const spellRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) 50px',
      minWidth: 0,
      boxSizing: 'border-box',
      width: '100%',
      '@media': {
        '(max-width: 700px)': {
          gridTemplateColumns: 'minmax(0, 1fr) 50px'
        },
        '(max-width: 360px)': {
          gridTemplateColumns: 'minmax(0, 1fr) 40px'
        }
      }
    }
  }
})

export const spellEntryButton = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderRadius: foundationVars.radius.sm,
      color: 'inherit',
      cursor: 'pointer',
      display: 'grid',
      font: 'inherit',
      gap: '8px',
      gridTemplateColumns: 'minmax(132px, 1.15fr) 58px 66px 74px minmax(108px, 0.82fr)',
      alignItems: 'center',
      margin: 0,
      minHeight: '42px',
      padding: '5px 8px',
      textAlign: 'left',
      width: '100%',
      '@media': {
        '(max-width: 700px)': {
          gap: '3px',
          gridTemplateColumns: 'minmax(66px, 1.2fr) 44px 40px 40px minmax(58px, 0.9fr)',
          minHeight: '44px',
          padding: '4px'
        },
        '(max-width: 360px)': {
          gridTemplateColumns: 'minmax(60px, 1fr) 34px 34px minmax(42px, 0.8fr)'
        }
      },
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.subtle
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        }
      }
    }
  }
})

export const spellFact = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.74rem',
      fontWeight: 650,
      minWidth: 0,
      overflow: 'hidden',
      textAlign: 'center',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const spellNameLine = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '1px',
      minWidth: 0,
      overflow: 'hidden',
      whiteSpace: 'nowrap'
    }
  }
})

globalStyle(`${spellNameLine} > span`, {
  '@layer': {
    [app]: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const spellQualifier = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      '@media': {
        '(max-width: 360px)': {
          display: 'none'
        }
      }
    }
  }
})

export const spellEffectLine = style({
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
      justifyContent: 'center',
      maxWidth: '100%',
      minWidth: 0,
      textAlign: 'center',
      width: '100%',
      '@media': {
        '(max-width: 700px)': {
          alignItems: 'center',
          fontSize: '0.72rem',
          gap: 0
        }
      }
    }
  }
})

export const spellPrimaryEffect = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.74rem',
      fontWeight: 650,
      maxWidth: '100%',
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      width: '100%',
      whiteSpace: 'nowrap'
    }
  }
})

export const spellActivationFact = style({
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 360px)': {
          display: 'none'
        }
      }
    }
  }
})

export const spellInlineSeparator = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      flex: '0 0 auto',
      '@media': {
        '(max-width: 620px)': {
          display: 'none'
        }
      }
    }
  }
})

export const spellUnavailable = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      flex: '1 1 180px',
      lineHeight: 1.25,
      whiteSpace: 'normal',
      '@media': {
        '(max-width: 620px)': {
          flexBasis: 'auto',
          width: '100%'
        }
      }
    }
  }
})

export const spellCastButton = style({
  '@layer': {
    [app]: {
      alignSelf: 'center',
      justifySelf: 'center',
      margin: 0,
      minHeight: '30px',
      minWidth: '42px',
      paddingInline: '5px',
      '@media': {
        '(max-width: 700px)': {
          justifySelf: 'start',
          minWidth: '36px',
          paddingInline: '2px'
        },
        '(max-width: 360px)': {
          minWidth: '32px'
        }
      }
    }
  }
})

export const spellCommandError = style([
  commandInlineError,
  {
    '@layer': {
      [app]: {
        gridColumn: '1 / -1',
        padding: '0 8px 6px'
      }
    }
  }
])

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
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      paddingTop: '16px'
    }
  }
})

export const inlineControlRow = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      '@media': { '(max-width: 420px)': { gridTemplateColumns: '1fr' } }
    }
  }
})

export const noteViewer = style({
  '@layer': { [app]: { display: 'grid', gap: '24px', minHeight: '360px' } }
})

export const noteHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'flex',
      gap: '16px',
      justifyContent: 'space-between',
      paddingBottom: '16px'
    }
  }
})

export const noteTitle = style({
  '@layer': { [app]: { marginTop: '8px', textWrap: 'balance' } }
})

export const noteBody = style({
  '@layer': { [app]: { maxWidth: '72ch', minHeight: '240px' } }
})

export const sheetEmptyState = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'grid',
      gap: '10px',
      justifyItems: 'center',
      minHeight: '320px',
      padding: '32px',
      textAlign: 'center'
    }
  }
})

export const readOnlyDetails = style({
  '@layer': {
    [app]: { borderTop: `1px solid ${foundationVars.color.border.subtle}`, paddingTop: '12px' }
  }
})

export const noteBrowseList = style({
  '@layer': { [app]: { display: 'grid', gap: '4px', maxHeight: '40vh', overflowY: 'auto' } }
})

export const noteBrowseItem = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      display: 'flex',
      font: 'inherit',
      justifyContent: 'space-between',
      padding: '10px',
      textAlign: 'left',
      selectors: {
        '&:hover': { background: foundationVars.color.surface.subtle },
        '&:focus-visible': { outline: `2px solid ${foundationVars.color.accent.solid}` }
      }
    }
  }
})

export const groupManagementRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between',
      minHeight: '34px'
    }
  }
})

export const modalActions = style({
  '@layer': {
    [app]: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }
  }
})

export const inventorySummary = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px 14px',
      minHeight: '24px'
    }
  }
})

export const inventoryDataTable = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minWidth: 0
    }
  }
})

export const inventoryDataHeader = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      display: 'grid',
      fontSize: '0.6rem',
      fontWeight: 700,
      gap: '10px',
      gridTemplateColumns:
        'minmax(160px, 1.2fr) 44px 80px minmax(92px, 0.55fr) minmax(78px, 0.42fr)',
      letterSpacing: '0.035em',
      padding: '7px 8px 5px',
      textTransform: 'uppercase',
      '@media': {
        '(max-width: 620px)': {
          display: 'none'
        }
      }
    }
  }
})

export const inventoryDataRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: 'inherit',
      cursor: 'pointer',
      display: 'grid',
      font: 'inherit',
      gap: '10px',
      gridTemplateColumns:
        'minmax(160px, 1.2fr) 44px 80px minmax(92px, 0.55fr) minmax(78px, 0.42fr)',
      minHeight: '42px',
      minWidth: 0,
      padding: '6px 8px',
      textAlign: 'left',
      width: '100%',
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'start',
          gap: '7px 10px',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          minHeight: 'unset',
          paddingBlock: '9px'
        }
      },
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.subtle
        },
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 0
        },
        '&:disabled': {
          cursor: 'default',
          opacity: 1
        },
        '&:last-child': {
          borderBottom: 0
        }
      }
    }
  }
})

export const inventoryItemIdentity = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '1px',
      minWidth: 0,
      '@media': {
        '(max-width: 620px)': {
          gridColumn: '1 / -1'
        }
      }
    }
  }
})

globalStyle(`${inventoryItemIdentity} > strong`, {
  '@layer': {
    [app]: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

globalStyle(`${inventoryItemIdentity} > small`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.66rem',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const inventoryDataCell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '1px',
      minWidth: 0,
      '@media': {
        '(max-width: 620px)': {
          gap: '2px'
        }
      }
    }
  }
})

globalStyle(`${inventoryDataCell} > small`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      display: 'none',
      fontSize: '0.58rem',
      fontWeight: 700,
      letterSpacing: '0.025em',
      textTransform: 'uppercase',
      '@media': {
        '(max-width: 620px)': {
          display: 'block'
        }
      }
    }
  }
})

globalStyle(`${inventoryDataCell} > strong`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.74rem',
      fontWeight: 650,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
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
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      paddingTop: '10px'
    }
  }
})

export const containerHeading = style({
  '@layer': {
    [app]: { alignItems: 'center', display: 'flex', gap: '12px', justifyContent: 'space-between' }
  }
})

export const itemManagementRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(140px, 0.75fr)'
    }
  }
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

globalStyle(`${inventorySummary} > span`, {
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      display: 'inline-flex',
      gap: '4px',
      minWidth: 0
    }
  }
})

globalStyle(`${inventorySummary} small`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.72rem'
    }
  }
})

export const extrasList = style({
  '@layer': { [app]: { display: 'grid', gap: '14px' } }
})

export const extraGroup = style({
  '@layer': { [app]: { display: 'grid', minWidth: 0 } }
})

export const extraGroupTitle = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.accent,
      fontSize: '0.74rem',
      letterSpacing: '0.03em',
      margin: 0,
      padding: '3px 8px 6px',
      textTransform: 'uppercase'
    }
  }
})

export const extraGroupRows = style({
  '@layer': { [app]: { display: 'grid', minWidth: 0 } }
})

export const extraDataRow = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: 0,
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      display: 'grid',
      font: 'inherit',
      gap: '6px',
      minHeight: '52px',
      minWidth: 0,
      padding: '8px',
      textAlign: 'left',
      width: '100%',
      ':disabled': { cursor: 'default', opacity: 0.7 },
      ':focus-visible': { boxShadow: foundationVars.shadow.focus, outline: 'none' },
      '@media': {
        '(max-width: 760px)': {
          minHeight: '44px',
          padding: '7px 6px'
        }
      },
      selectors: {
        '&:hover:not(:disabled)': { background: foundationVars.color.surface.subtle },
        '&:last-child': { borderBottom: 0 }
      }
    }
  }
})

export const extraIdentity = style({
  '@layer': { [app]: { display: 'grid', gap: '2px', minWidth: 0, overflowWrap: 'anywhere' } }
})

export const extraStatBlock = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      minWidth: 0,
      '@media': {
        '(max-width: 760px)': {
          gap: '6px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(52px, 1fr))'
        }
      }
    }
  }
})

export const extraMetric = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '1px',
      minWidth: 0,
      overflowWrap: 'anywhere',
      '@media': { '(max-width: 760px)': { paddingTop: '1px' } }
    }
  }
})

export const extraMetricMobileHidden = style([
  extraMetric,
  {
    '@layer': {
      [app]: {
        '@media': {
          '(max-width: 760px)': {
            display: 'none'
          }
        }
      }
    }
  }
])

export const extraMetricLabel = style({
  '@layer': { [app]: { color: foundationVars.color.text.secondary, fontSize: '0.68rem' } }
})

export const extraDrawerBody = style({
  '@layer': { [app]: { display: 'grid', gap: '16px', paddingBottom: '16px' } }
})

export const extraDrawerActions = style({
  '@layer': { [app]: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }
})
