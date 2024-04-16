import { style, createVar } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const grid_size = createVar('grid-size')

export const grid = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'grid',
      width: '100%',
      gridTemplateColumns: grid_size,
      columnGap: size['size-1'],
      rowGap: size['size-3'],
    },
  },
})
