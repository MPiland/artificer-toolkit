import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

const quietButtonFocus = {
  outline: `1px solid ${foundationVars.color.input.border.focus}`,
  outlineOffset: 2,
  boxShadow: 'none'
} as const

export const sectionTable = style({
  '@layer': {
    [app]: {
      display: 'grid',
      boxSizing: 'border-box',
      inlineSize: '100%',
      maxInlineSize: '100%',
      minInlineSize: 0,
      padding: `0 ${foundationVars.space[3]} ${foundationVars.space[3]}`,
      border: 0,
      selectors: {
        '&[data-layout="mobileLandscape"], &[data-layout="mobilePortrait"], &[data-layout="tablet"]': {
          padding: 0
        }
      }
    }
  }
})

export const sectionTableHeader = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'var(--forge-table-columns)',
      minInlineSize: 0,
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

export const sectionTableHeaderCell = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.dim,
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.semibold,
      backgroundColor: foundationVars.color.surface.emphasized,
      lineHeight: '14px',
      paddingInline: foundationVars.space[2],
      paddingBlock: foundationVars.space[3],
      selectors: {
        '&[data-align="center"]': {
          textAlign: 'center'
        },
        '&[data-align="end"]': {
          textAlign: 'end'
        }
      }
    }
  }
})

export const sectionTableRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'var(--forge-table-columns)',
      alignItems: 'center',
      minInlineSize: 0,
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const sectionTableRowCell = style({
  '@layer': {
    [app]: {
      margin: foundationVars.space[2],
      minInlineSize: 0,
      selectors: {
        '&[data-align="center"]': {
          textAlign: 'center'
        },
        '&[data-align="end"]': {
          textAlign: 'end'
        }
      }
    }
  }
})

export const compactInput = style({
  '@layer': {
    [app]: {
      minBlockSize: 32,
      blockSize: 32,
      border: '1px solid transparent',
      borderRadius: foundationVars.radius.sm,
      backgroundColor: 'transparent',
      color: foundationVars.color.text.primary,
      fontSize: '12px',
      transition: 'none',
      ':hover': {
        borderColor: foundationVars.color.border.subtle,
        backgroundColor: foundationVars.color.input.background.default
      },
      ':focus': {
        borderColor: foundationVars.color.input.border.focus,
        backgroundColor: foundationVars.color.input.background.default,
        boxShadow: 'none'
      },
      ':focus-within': {
        borderColor: foundationVars.color.input.border.focus,
        backgroundColor: foundationVars.color.input.background.default,
        boxShadow: 'none'
      }
    }
  }
})

export const diceInput = style([
  compactInput,
  {
    '@layer': {
      [app]: {
        color: foundationVars.color.damage.fire,
        fontFamily: foundationVars.font.mono,
        fontWeight: foundationVars.fontWeight.semibold
      }
    }
  }
])

export const summaryDamage = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.damage.fire,
      fontFamily: foundationVars.font.mono,
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

export const rowIconButton = style({
  '@layer': {
    [app]: {
      alignSelf: 'end',
      inlineSize: 30,
      blockSize: 30,
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.muted,
      ':hover': {
        color: foundationVars.color.status.danger,
        backgroundColor: foundationVars.color.status.dangerSoft
      },
      ':focus-visible': {
        ...quietButtonFocus
      }
    }
  }
})

export const summaryList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0,
      padding: 0,
      margin: 0,
      listStyle: 'none'
    }
  }
})

export const summaryItem = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: foundationVars.space[3],
      minBlockSize: 56,
      paddingInline: foundationVars.space[3],
      paddingBlock: foundationVars.space[2],
      border: 0,
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: 0,
      backgroundColor: foundationVars.color.surface.subtle,
      selectors: {
        '&:first-child': {
          borderBlockStart: 0
        }
      }
    }
  }
})

export const summaryCopy = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 2,
      minInlineSize: 0
    }
  }
})

export const summaryTitle = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.bodySm.lineHeight,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const summaryText = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const summaryActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2
    }
  }
})

export const summaryIconButton = style({
  '@layer': {
    [app]: {
      inlineSize: 30,
      blockSize: 30,
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.secondary,
      ':hover': {
        color: foundationVars.color.accent.solid,
        backgroundColor: foundationVars.color.accent.soft
      },
      ':focus-visible': {
        ...quietButtonFocus
      }
    }
  }
})

export const addRow = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      justifyContent: 'center',
      inlineSize: '100%',
      paddingInline: foundationVars.space[2],
      paddingBlock: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      marginBlockStart: foundationVars.space[2],
      backgroundColor: foundationVars.color.surface.panel,
      color: foundationVars.color.text.secondary,
      cursor: 'pointer',
      ':hover': {
        backgroundColor: foundationVars.color.surface.raised
      },
      ':focus-visible': {
        ...quietButtonFocus
      },
      selectors: {
        [`${sectionTable}[data-layout="mobileLandscape"] &, ${sectionTable}[data-layout="mobilePortrait"] &, ${sectionTable}[data-layout="tablet"] &`]: {
          justifyContent: 'start',
          marginBlockStart: 0,
          paddingInline: foundationVars.space[3],
          borderInline: 0,
          borderBlockEnd: 0,
          borderRadius: 0,
          backgroundColor: foundationVars.color.surface.subtle
        }
      }
    }
  }
})

export const editorForm = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4]
    }
  }
})

export const editorFormGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      '@media': {
        'screen and (max-width: 520px)': {
          gridTemplateColumns: 'minmax(0, 1fr)'
        }
      }
    }
  }
})

export const editorInput = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.input.border.default,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.primary,
      ':focus': {
        borderColor: foundationVars.color.input.border.focus,
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const editorDiceInput = style([
  editorInput,
  {
    '@layer': {
      [app]: {
        color: foundationVars.color.damage.fire,
        fontFamily: foundationVars.font.mono,
        fontWeight: foundationVars.fontWeight.semibold
      }
    }
  }
])

export const editorLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const drawerStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4]
    }
  }
})

export const drawerFooter = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2],
      paddingBlockStart: foundationVars.space[4],
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      '@media': {
        'screen and (max-width: 640px) and (orientation: portrait)': {
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        }
      }
    }
  }
})

export const drawerButton = style({
  '@layer': {
    [app]: {
      ':focus-visible': {
        ...quietButtonFocus
      }
    }
  }
})

export const addIcon = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      inlineSize: 24,
      blockSize: 24,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: 'transparent'
    }
  }
})

export const addCopy = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 1,
      minInlineSize: 0
    }
  }
})

export const addTitle = style({
  '@layer': {
    [app]: {
      color: 'inherit',
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})
