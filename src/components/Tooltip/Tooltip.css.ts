import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'
import palette from '../../css/colors.css'

export const tooltip_message = style({
  '@layer': {
    [app]: {
      backgroundColor: palette['red-6'],
      padding: `${size['size-0']} ${size['size-1']}`,
      borderRadius: size['size-1'],
      color: 'white',
      maxWidth: '14rem',
      textWrap: 'wrap',
    },
  },
})

export const tooltip_nowrapper = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: 'inherit',
    },
  },
})
