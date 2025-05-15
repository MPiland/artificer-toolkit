import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const floating_content = style({
  '@layer': {
    [app]: {
      padding: size['size-2'],
      zIndex: 10000,
    },
  },
})

export const floating_arrow = style({
  '@layer': {
    [app]: {
      backgroundColor: 'transparent',
    },
  },
})

export const floating_nowrapper = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: 'inherit',
    },
  },
})

export const floating_option = style({
  '@layer': {
    [app]: {
      cursor: 'default',
      padding: `${size['size-1']} ${size['size-3']}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',

      selectors: {
        '&:focus': {
          outline: 'none',
          backgroundColor: 'rgb(118, 184, 255)',
        },
      },
    },
  },
})

export const floating_option_right_side = style({
  width: '1rem',
  marginLeft: size['size-2'],
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'row',
})
