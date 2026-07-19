import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const tree = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minBlockSize: 0,
      overflowY: 'auto',
      paddingBlock: foundationVars.space[2],
      paddingInline: 0
    }
  }
})
