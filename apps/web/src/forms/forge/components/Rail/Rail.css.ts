import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const rail = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr) auto',
      inlineSize: '100%',
      blockSize: '100%',
      minInlineSize: 0,
      minBlockSize: 0,
      overflow: 'hidden',
      borderInlineEnd: `1px solid ${foundationVars.color.border.strong}`,
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.primary
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      gap: foundationVars.space[3],
      padding: foundationVars.space[4],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const headerText = style({
  '@layer': {
    [app]: {
      minInlineSize: 0
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '16px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '20px'
    }
  }
})

export const subtitle = style({
  '@layer': {
    [app]: {
      margin: `${foundationVars.space[1]} 0 0`,
      overflow: 'hidden',
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const tree = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minBlockSize: 0,
      overflowY: 'auto',
      padding: foundationVars.space[2]
    }
  }
})

export const footer = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[1],
      minBlockSize: 34,
      padding: `${foundationVars.space[1]} ${foundationVars.space[3]}`,
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const summaryItem = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minInlineSize: 0,
      color: foundationVars.color.text.secondary
    }
  }
})

export const summaryValue = style({
  '@layer': {
    [app]: {
      color: 'inherit',
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: '14px',
      whiteSpace: 'nowrap'
    }
  }
})
