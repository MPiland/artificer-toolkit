import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

export const canvas = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      blockSize: '100%',
      inlineSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0
    }
  }
})

export const workspace = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      blockSize: '100%',
      inlineSize: 'auto',
      overflow: 'hidden'
    }
  }
})
