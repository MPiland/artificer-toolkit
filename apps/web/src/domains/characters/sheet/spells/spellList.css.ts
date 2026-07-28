import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'
import { commandInlineError } from '../shared/rows.css'

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
          display: 'none'
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
          gap: '2px',
          gridTemplateColumns: 'minmax(0, 1fr)',
          minHeight: '44px',
          padding: '6px 4px'
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

globalStyle(`${spellEntryButton} > ${spellFact}`, {
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 700px)': {
          display: 'none'
        }
      }
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
          alignItems: 'baseline',
          fontSize: '0.72rem',
          gap: '2px',
          justifyContent: 'flex-start',
          textAlign: 'left'
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
      whiteSpace: 'nowrap',
      '@media': {
        '(max-width: 700px)': {
          textAlign: 'left'
        }
      }
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
        '(max-width: 700px)': {
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
        '(max-width: 700px)': {
          flexBasis: 'auto',
          textAlign: 'left',
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
          minHeight: '44px',
          minWidth: '44px',
          paddingInline: '4px'
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
