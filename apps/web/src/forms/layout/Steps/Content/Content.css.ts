import { style } from '@vanilla-extract/css'
import { app } from '../../../../css/layers.css.ts'

export const tree = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      minBlockSize: 0,
      overflowY: 'auto',
      paddingBlock: 0,
      paddingInline: 0
    }
  }
})
