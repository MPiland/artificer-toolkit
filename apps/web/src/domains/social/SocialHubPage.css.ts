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
      minInlineSize: 0,
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
