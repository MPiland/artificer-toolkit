import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const combatPanel = style({
  '@layer': {
    [app]: {
      alignContent: 'center',
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'minmax(300px, 1fr) minmax(260px, 0.72fr)',
      minWidth: 0,
      padding: '8px 12px',
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

export const restActionButton = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
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
      alignContent: 'start',
      alignItems: 'center',
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '6px',
      gridTemplateRows: 'auto auto',
      minWidth: 0,
      padding: '2px 12px 2px 0',
      '@media': {
        '(max-width: 760px)': {
          alignContent: 'center',
          borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
          borderInlineEnd: 0,
          gridTemplateRows: 'auto auto',
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
      gridTemplateColumns: 'repeat(auto-fit, minmax(78px, 1fr))',
      minWidth: 0,
      '@media': {
        '(max-width: 560px)': {
          justifyItems: 'center',
          textAlign: 'center'
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
      padding: '6px 12px 0',
      '@media': {
        '(max-width: 760px)': {
          display: 'none'
        }
      }
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

export const desktopDefenseGroupButton = style([
  desktopDefenseGroup,
  {
    '@layer': {
      [app]: {
        appearance: 'none',
        background: 'transparent',
        border: 0,
        borderRadius: foundationVars.radius.sm,
        color: 'inherit',
        cursor: 'pointer',
        font: 'inherit',
        padding: '3px 4px',
        textAlign: 'left',
        selectors: {
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
  }
])

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

export const hpCard = style({
  '@layer': {
    [app]: {
      alignContent: 'stretch',
      alignItems: 'center',
      display: 'grid',
      gap: '6px',
      gridTemplateRows: 'auto auto',
      minWidth: 0,
      padding: '2px 12px 2px 0',
      '@media': {
        '(max-width: 760px)': {
          alignContent: 'center',
          borderInlineEnd: 0,
          gridTemplateRows: 'auto auto',
          padding: 0
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
      gridTemplateAreas: '"top minor"',
      gridTemplateColumns: 'minmax(104px, 0.72fr) minmax(0, 1.28fr)',
      minWidth: 0,
      padding: '4px 0',
      rowGap: '10px',
      '@media': {
        '(max-width: 48rem)': {
          alignItems: 'center',
          columnGap: '8px',
          gridTemplateAreas: '"top minor"',
          gridTemplateColumns: 'minmax(76px, 0.82fr) minmax(118px, 1.38fr)',
          padding: '2px 0'
        },
        '(max-width: 340px)': {
          columnGap: '4px',
          gridTemplateColumns: 'minmax(68px, 0.78fr) minmax(108px, 1.34fr)'
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
      fontSize: '0.94rem',
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
      fontSize: '0.82rem',
      fontWeight: 700,
      paddingInline: '4px',
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
      alignItems: 'center',
      alignSelf: 'stretch',
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'flex',
      gap: '6px',
      justifyContent: 'space-between',
      minWidth: 0,
      paddingBlockStart: '8px',
      '@media': {
        '(max-width: 48rem)': {
          alignSelf: 'center'
        },
        '(max-width: 22rem)': {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
    }
  }
})

export const hpManageButton = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      minWidth: 0,
      '@media': {
        '(max-width: 520px)': {
          paddingInline: '6px'
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
