import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css'
import { app } from '../../css/layers.css'

export const root = style({
  '@layer': {
    [app]: {
      blockSize: '100%',
      minBlockSize: 0,
      minInlineSize: 0,
      padding: foundationVars.space[2],
      overflow: 'auto'
    }
  }
})
