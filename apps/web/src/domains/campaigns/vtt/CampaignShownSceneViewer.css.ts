import { globalStyle, style } from '@vanilla-extract/css'
import { app } from '#app/css/layers.css'

export const canvasFrame = style({
  '@layer': {
    [app]: {
      position: 'relative',
      overflow: 'hidden',
      blockSize: '70dvh',
      background: '#101315',
      touchAction: 'none',
      userSelect: 'none'
    }
  }
})

globalStyle(`${canvasFrame} canvas`, {
  '@layer': {
    [app]: {
      display: 'block',
      inlineSize: '100%',
      blockSize: '100%'
    }
  }
})
