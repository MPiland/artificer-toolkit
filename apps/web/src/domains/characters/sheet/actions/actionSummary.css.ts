import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

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
        '(max-width: 959px)': {
          gridTemplateColumns: 'minmax(84px, 1.15fr) 44px 44px minmax(72px, 0.9fr)'
        },
        '(max-width: 340px)': {
          gridTemplateColumns: 'minmax(64px, 1.15fr) 38px 38px minmax(58px, 0.9fr)'
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

globalStyle(`${actionDescriptionText} > div`, {
  '@layer': {
    [app]: {
      fontSize: 'inherit',
      lineHeight: 'inherit',
      maxWidth: 'inherit'
    }
  }
})

globalStyle(`${actionDescriptionText} p`, {
  '@layer': {
    [app]: {
      margin: 0
    }
  }
})

export const actionSpellSlotExchange = style({
  '@layer': {
    [app]: {
      alignItems: 'flex-end',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px 8px',
      minWidth: 0
    }
  }
})

export const actionSpellSlotCount = style({
  '@layer': {
    [app]: {
      width: '5.5rem'
    }
  }
})
