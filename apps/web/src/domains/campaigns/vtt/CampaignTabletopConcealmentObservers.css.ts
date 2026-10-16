import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const list = style({
  '@layer': {
    [app]: { listStyle: 'none', margin: 0, padding: 0 }
  }
})

export const item = style({
  '@layer': {
    [app]: { alignItems: 'center', display: 'flex', gap: foundationVars.space[2] }
  }
})
