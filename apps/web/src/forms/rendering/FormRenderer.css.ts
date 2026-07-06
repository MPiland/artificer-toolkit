import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

export const formShell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space['5'],
      width: '100%'
    }
  }
})

export const sectionNav = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space['2'],
      alignSelf: 'start',
      position: 'sticky',
      top: foundationVars.space['4']
    }
  }
})

export const sectionStack = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space['5']
    }
  }
})

export const sectionPanel = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel,
      padding: foundationVars.space['5']
    }
  }
})

export const fieldGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: foundationVars.space['4'],

      '@media': {
        '(max-width: 768px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const wideField = style({
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
    }
  }
})

export const inlineObjectStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space['4'],
      width: '100%'
    }
  }
})

export const inlineObjectSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space['3']
    }
  }
})

export const inlineArrayList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space['3']
    }
  }
})

export const inlineArrayItem = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space['3'],
      paddingBlock: foundationVars.space['3'],
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,

      ':last-child': {
        borderBottom: 0
      }
    }
  }
})

export const inlineArrayItemHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space['3']
    }
  }
})

export const inlineArrayItemTrigger = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      alignSelf: 'stretch',
      flex: '1 1 auto',
      gap: foundationVars.space['2'],
      minWidth: 0,
      width: '100%',
      paddingBlock: foundationVars.space['1'],
      paddingInline: 0,
      border: 0,
      background: 'transparent',
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      justifyContent: 'flex-start',
      textAlign: 'left'
    }
  }
})

export const inlineArrayItemTitle = style({
  '@layer': {
    [app]: {
      display: 'block',
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '14px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '20px'
    }
  }
})

export const inlineArrayItemDescription = style({
  '@layer': {
    [app]: {
      display: 'block',
      margin: 0,
      color: foundationVars.color.text.muted,
      fontSize: '13px',
      lineHeight: '19px'
    }
  }
})

export const inlineArrayItemActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space['1'],
      flexShrink: 0
    }
  }
})

export const inlineArrayItemChevron = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      color: foundationVars.color.text.secondary,
      transition: `transform ${foundationVars.motion.fast} ease`
    }
  }
})

export const inlineArrayItemChevronOpen = style({
  '@layer': {
    [app]: {
      transform: 'rotate(180deg)'
    }
  }
})

export const inlineArrayItemBody = style({
  '@layer': {
    [app]: {
      marginTop: foundationVars.space['2'],
      padding: foundationVars.space['4'],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.raised
    }
  }
})

export const compactInlineArrayItem = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'end',
      gap: foundationVars.space['3'],
      paddingBlock: foundationVars.space['3'],
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const compactInlineArrayItemContent = style({
  '@layer': {
    [app]: {
      minWidth: 0
    }
  }
})

export const damageScalingArrayList = style({
  '@layer': {
    [app]: {
      gap: 0,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.panel,
      overflow: 'hidden'
    }
  }
})

export const damageScalingItem = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space['3'],
      background: foundationVars.color.surface.panel,

      ':last-child': {
        borderBottom: 0
      },

      selectors: {
        '&:focus-within': {
          background: foundationVars.color.accent.soft
        }
      }
    }
  }
})

export const startingEquipmentArrayList = style({
  '@layer': {
    [app]: {
      gap: foundationVars.space['4']
    }
  }
})

export const startingEquipmentSetItem = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space['4'],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel
    }
  }
})

export const startingEquipmentSetBody = style({
  '@layer': {
    [app]: {
      marginTop: foundationVars.space['2'],
      paddingTop: foundationVars.space['4'],
      borderTop: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const startingEquipmentGroupItem = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space['4'],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.raised
    }
  }
})

export const startingEquipmentOptionItem = style({
  '@layer': {
    [app]: {
      paddingBlock: foundationVars.space['4'],
      borderBottom: '0',

      selectors: {
        '&:not(:first-child)': {
          borderTop: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const startingEquipmentItemRow = style({
  '@layer': {
    [app]: {
      gap: foundationVars.space['2'],
      paddingBlock: foundationVars.space['2'],
      borderBottom: '0'
    }
  }
})

export const nestedShell = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space['3'],
      border: `1px dashed ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      padding: foundationVars.space['4']
    }
  }
})
