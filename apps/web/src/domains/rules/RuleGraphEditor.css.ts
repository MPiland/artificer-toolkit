import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css'
import { app } from '../../css/layers.css'

export const root = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '10rem minmax(0, 1fr)',
      blockSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0
    }
  }
})

export const canvas = style({
  '@layer': {
    [app]: {
      blockSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})
