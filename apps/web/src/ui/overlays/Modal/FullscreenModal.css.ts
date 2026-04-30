import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const fullscreenContent = style({
  '@layer': {
    [app]: {
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

export const fullscreenBody = style({
  '@layer': {
    [app]: {
      padding: 0,
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})
