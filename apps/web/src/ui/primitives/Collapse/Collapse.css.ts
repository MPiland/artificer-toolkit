import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const base = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      marginBottom: foundationVars.space[4],
      outline: 'none',
      padding: `0 ${foundationVars.space[4]}`,
      vars: {
        '--grid-margin': '0'
      }
    }
  }
})

export const borderless = style({
  '@layer': {
    [app]: {
      border: '0',
      borderRadius: 0,
      marginBottom: 0,
      padding: 0,
      backgroundColor: 'transparent'
    }
  }
})
