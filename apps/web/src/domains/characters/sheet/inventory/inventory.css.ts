import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

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
        'minmax(145px, 1.1fr) 40px 72px minmax(118px, 0.65fr) minmax(68px, 0.4fr)',
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
        'minmax(145px, 1.1fr) 40px 72px minmax(118px, 0.65fr) minmax(68px, 0.4fr)',
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
      whiteSpace: 'nowrap',
      '@media': {
        '(max-width: 620px)': {
          overflow: 'visible',
          textOverflow: 'clip',
          whiteSpace: 'normal'
        }
      }
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
