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
      'display': 'grid',
      'gridTemplateColumns': 'repeat(2, minmax(0, 1fr))',
      'gap': foundationVars.space['4'],

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
      gap: foundationVars.space['2'],
      minWidth: 0,
      padding: 0,
      border: 0,
      background: 'transparent',
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
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
      paddingTop: foundationVars.space['2']
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
