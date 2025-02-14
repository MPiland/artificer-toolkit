import { createVar, style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

export const column_width = createVar('column_width')

export const column = style({
  '@layer': {
    [app]: {
      width: column_width,
      alignContent: 'end',
    },
  },
})
