import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const header = style({
  '@layer': {
    [app]: {
      minBlockSize: 60,
      paddingInline: foundationVars.space[4],
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const headerActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2],
      alignSelf: 'center',
      minInlineSize: 0,
      flexShrink: 0
    }
  }
})

export const closeButton = style({
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

export const sectionLabel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignItems: 'center',
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
      letterSpacing: '0.02em',
      lineHeight: '24px',
      textTransform: 'uppercase',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})
