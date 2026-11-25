import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const notice = style({
  '@layer': {
    [app]: {
      display: 'grid',
      placeItems: 'center',
      alignContent: 'center',
      gap: foundationVars.space[3],
      minBlockSize: '100dvh',
      padding: foundationVars.space[4],
      textAlign: 'center',
      background: foundationVars.color.surface.header,
      color: foundationVars.color.text.primary
    }
  }
})

export const cover = style([
  notice,
  {
    '@layer': {
      [app]: {
        position: 'fixed',
        inset: 0,
        zIndex: 100
      }
    }
  }
])
