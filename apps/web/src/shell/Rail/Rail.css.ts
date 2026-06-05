import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

export const rail = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
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

export const sectionLabel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 1,
      minInlineSize: 0
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '18px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const sectionSubtitle = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: '14px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const structureHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[2],
      paddingInline: foundationVars.space[3],
      paddingBlock: foundationVars.space[2],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.raised
    }
  }
})

export const structureCloseButton = style({
  '@layer': {
    [app]: {
      inlineSize: 30,
      blockSize: 30,
      flexShrink: 0,
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.secondary,
      ':hover': {
        backgroundColor: foundationVars.color.surface.subtle,
        color: foundationVars.color.text.primary
      },
      ':focus-visible': {
        outline: 'none',
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const structurePanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr) auto',
      flex: 1,
      blockSize: '100%',
      minBlockSize: 0
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
