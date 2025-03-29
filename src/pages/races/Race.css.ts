import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { space } from '../../css/size.css'

export const race_section_divider = style({
  '@layer': {
    [app]: {
      marginBottom: space['space-4'],
    },
  },
})
