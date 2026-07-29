import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'
import { sheetDesktop } from '../core/sheetShell.css'
import { overviewPanel } from './overview.css'

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
