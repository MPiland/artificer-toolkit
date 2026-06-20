import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const headerText = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      minInlineSize: 0
    }
  }
})

export const titleRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'nowrap',
      alignItems: 'center',
      minInlineSize: 0,
      gap: foundationVars.space[2]
    }
  }
})

export const titleActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1]
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      margin: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      color: foundationVars.color.text.primary,
      fontSize: '22px',
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '0',
      lineHeight: '28px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const statusBadge = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minBlockSize: 24,
      paddingInline: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '16px',
      alignSelf: 'center',
      whiteSpace: 'nowrap'
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
      flexShrink: 0,
      '@media': {
        [media.mobile]: {
          justifyContent: 'flex-start',
          alignSelf: 'center'
        }
      }
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
      lineHeight: '24px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})
