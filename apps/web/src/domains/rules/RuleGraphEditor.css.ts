import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css'
import { app } from '../../css/layers.css'

export const root = style({
  '@layer': {
    [app]: {
      blockSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0
    }
  }
})

export const canvas = style({
  '@layer': {
    [app]: {
      position: 'relative',
      blockSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

globalStyle(`${canvas} .grl-dg__aside__menu`, {
  '@layer': {
    [app]: {
      display: 'none'
    }
  }
})
