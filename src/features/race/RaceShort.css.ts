import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const feature_container = style({
  '@layer': {
    [app]: {
      marginBottom: size['size-3'],
    },
  },
})

export const feature_header = style({
  '@layer': {
    [app]: {
      background: 'lightgrey',
    },
  },
})
