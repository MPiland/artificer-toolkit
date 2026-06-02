import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const previewCard = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0,
      padding: 0,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.panel,
      overflow: 'hidden'
    }
  }
})

export const moduleHeader = style({
  '@layer': {
    [app]: {
      padding: `${foundationVars.space[3]} ${foundationVars.space[3]}`,
      color: foundationVars.color.text.dim,

      selectors: {
        '&[data-emphasized="true"]': {
          backgroundColor: foundationVars.color.surface.emphasized
        },
        '&[data-divider="true"]': {
          padding: `${foundationVars.space[3]} ${foundationVars.space[3]} 0`
        }
      }
    }
  }
})

export const moduleHeaderDivider = style({
  '@layer': {
    [app]: {
      marginBlock: `${foundationVars.space[3]} 0`,
      border: 'none',
      borderTop: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const moduleBody = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      padding: foundationVars.space[3]
    }
  }
})

export const previewTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      fontSize: '13px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '18px'
    }
  }
})

export const previewText = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '13px',
      lineHeight: '19px',
      textWrap: 'pretty'
    }
  }
})

export const previewSubheading = style({
  '@layer': {
    [app]: {
      margin: `${foundationVars.space[1]} 0 0`,
      color: foundationVars.color.text.primary,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '16px'
    }
  }
})

export const ruleList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      margin: 0,
      padding: 0,
      listStyle: 'none'
    }
  }
})

export const ruleItem = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[2],
      padding: `${foundationVars.space[2]} ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.recessed,
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      lineHeight: '16px'
    }
  }
})

export const damageValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.damage.fire,
      fontFamily: foundationVars.font.mono,
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})
