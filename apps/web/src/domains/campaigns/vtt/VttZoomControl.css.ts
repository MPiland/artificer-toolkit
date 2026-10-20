import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const control = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1]
    }
  }
})

export const percent = style({
  '@layer': {
    [app]: {
      inlineSize: '4.25rem',
      textAlign: 'center'
    }
  }
})
