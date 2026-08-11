import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const page = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[5],
      inlineSize: '100%',
      maxInlineSize: '76rem',
      marginInline: 'auto'
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      '@media': { [media.mobile]: { flexDirection: 'column' } }
    }
  }
})

export const headerCopy = style({
  '@layer': { [app]: { display: 'grid', gap: foundationVars.space[1], maxInlineSize: '68ch' } }
})

export const headerActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: foundationVars.space[2]
    }
  }
})

export const managementTabs = style({
  '@layer': { [app]: { inlineSize: '100%', minInlineSize: 0 } }
})

export const managementTab = style({
  '@layer': {
    [app]: {
      backgroundColor: 'transparent',
      color: foundationVars.color.text.secondary,
      selectors: {
        '&:hover': {
          backgroundColor: 'transparent',
          color: foundationVars.color.text.primary
        },
        '&[data-active]': {
          backgroundColor: 'transparent',
          color: foundationVars.color.text.primary
        }
      }
    }
  }
})

export const form = style({
  '@layer': { [app]: { display: 'grid', gap: foundationVars.space[5] } }
})

export const actions = style({
  '@layer': { [app]: { display: 'flex', flexWrap: 'wrap', gap: foundationVars.space[2] } }
})
