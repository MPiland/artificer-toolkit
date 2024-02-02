import { style, createVar } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

export const grid_size = createVar('grid-size')

export const grid = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'grid',
      width: '100%',
      gridTemplateColumns: grid_size,
      columnGap: '.5rem',
    },
  },
})
