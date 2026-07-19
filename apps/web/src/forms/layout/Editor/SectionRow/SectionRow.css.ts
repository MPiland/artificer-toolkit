import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const list = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2]
    }
  }
})

export const emptyCopy = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '14px'
    }
  }
})

export const row = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: foundationVars.space[3],
      minHeight: '44px',
      padding: `${foundationVars.space[2]} 0`,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,

      ':last-child': {
        borderBottom: 0
      }
    }
  }
})

export const rowTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '14px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '20px'
    }
  }
})

export const rowDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '13px',
      lineHeight: '19px'
    }
  }
})

export const rowActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[1]
    }
  }
})

export const rowAction = style({
  '@layer': {
    [app]: {
      minInlineSize: 44,
      minBlockSize: 44
    }
  }
})
