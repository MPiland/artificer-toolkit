import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

const mobile = 'screen and (max-width: 640px)'

export const header = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridColumn: '1 / -1',
      maxInlineSize: '100%',
      '@media': {
        [mobile]: {
          gap: foundationVars.space[3]
        }
      }
    }
  }
})

export const headerText = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      minInlineSize: 0
    }
  }
})

export const stepTrail = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: foundationVars.space[1],
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      lineHeight: '16px'
    }
  }
})

export const stepTrailItem = style({
  '@layer': {
    [app]: {
      color: 'inherit',

      selectors: {
        ['&.current']: {
          color: foundationVars.color.text.primary,
          fontWeight: foundationVars.fontWeight.semibold
        }
      }
    }
  }
})

export const stepTrailSeparator = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted
    }
  }
})

export const titleRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: foundationVars.space[2]
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '22px',
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '0',
      lineHeight: '28px'
    }
  }
})

export const mechanicTag = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minBlockSize: 24,
      paddingInline: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.subtle,
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '16px'
    }
  }
})

export const divider = style({
  '@layer': {
    [app]: {
      margin: 0,
      border: 'none',
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      inlineSize: '100%',
      marginBlock: foundationVars.space[4]
    }
  }
})
