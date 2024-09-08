import { createVar, style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

export const column_width = createVar('column_width')
export const column_gap = createVar('column_gap')
export const row_gap = createVar('row_gap')

export const column = style({
  '@layer': {
    [app]: {
      width: column_width,
      margin: `${row_gap} ${column_gap}`,

      selectors: {
        '&:first-of-type': {
          marginLeft: 0,
        },
        '&:last-of-type': {
          marginLeft: 0,
        },
      },
    },
  },
})
