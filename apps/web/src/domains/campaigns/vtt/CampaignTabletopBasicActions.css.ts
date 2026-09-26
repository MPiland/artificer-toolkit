import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const section = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      paddingBlockStart: foundationVars.space[3],
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const list = style({
  '@layer': {
    [app]: {
      display: 'grid',
      margin: 0,
      padding: 0,
      listStyle: 'none'
    }
  }
})

export const row = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: foundationVars.space[2],
      paddingBlock: foundationVars.space[2],
      selectors: {
        '& + &': {
          borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})
