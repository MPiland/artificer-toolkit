import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'
import { theme } from '../../css/theme.css'

export const tooltip_message = style({
  '@layer': {
    [app]: {
      padding: `${size['size-0']} ${size['size-1']}`,
      borderRadius: size['size-1'],
      color: 'white',
      maxWidth: '14rem',
      textWrap: 'wrap',

      selectors: {
        '&.invalid': {
          backgroundColor: theme.color.error,
        },
      },
    },
  },
})

export const tooltip_arrow = style({
  '@layer': {
    [app]: {
      backgroundColor: theme.vars.color,
      
      selectors: {
        [`${tooltip_message}.invalid &`]: {
          backgroundColor: theme.color.error,
        },
      },
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
