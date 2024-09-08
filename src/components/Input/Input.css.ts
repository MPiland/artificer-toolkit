import { style, globalStyle, styleVariants } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { theme } from '../../css/theme.css'
import { size } from '../../css/size.css'

export const input_wrapper = style({
  '@layer': {
    [app]: {
      height: 'fit-content',
      overflow: 'hidden',
      textWrap: 'nowrap',
      textOverflow: 'ellipsis',
    },
  },
})

export const input_label = style({
  '@layer': {
    [app]: {
      selectors: {
        '&.required:after': {
          content: '*',
          color: 'red',
          right: 0,
        },
      },
    },
  },
})

export const input_container = style({
  '@layer': {
    [app]: {
      position: 'relative',
      fontSize: 'inherit',
      height: theme.input.height,
      padding: '0 .75rem',
    },
  },
})

export const input_left_section = style({
  '@layer': {
    [app]: {
      zIndex: '1',
      position: 'absolute',
      top: '0',
      left: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '2rem',
      height: '100%',
    },
  },
})

export const input_right_section = style({
  '@layer': {
    [app]: {
      zIndex: '1',
      position: 'absolute',
      top: '0',
      right: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '2rem',
      height: '100%',
    },
  },
})

export const input = style({
  '@layer': {
    [app]: {
      'position': 'relative',
      'backgroundColor': 'transparent',
      'width': '100%',
      'height': '100%',
      'fontSize': 'inherit',
      'fontWeight': 'inherit',
      'border': 'none',

      '@media': {
        'screen and (max-width: 567px)': {
          padding: '0 .25rem',
        },
      },

      'selectors': {
        '&:focus': {
          outline: 'none',
        },
        '&.left': {
          paddingLeft: '2rem',
        },
        '&.right': {
          paddingRight: '2rem',
        },
      },
    },
  },
})

globalStyle(`${input_left_section} > span`, {
  '@layer': {
    [app]: {
      display: 'inline-block',
      maxHeight: 'fit-content',
    },
  },
})

globalStyle(`${input_right_section} > span`, {
  '@layer': {
    [app]: {
      display: 'inline-block',
      maxHeight: 'fit-content',
    },
  },
})

globalStyle('.input_label > span > *', {
  '@layer': {
    [app]: {
      transform: 'scale(1.5)',
    },
  },
})

export const input_height = styleVariants({
  default: { height: theme.input.height },
  auto: { height: size['size-auto'] },
  full: { height: size['size-full'] },
})

export const input_textAlign = styleVariants({
  default: { textAlign: 'left' },
  center: { textAlign: 'center' },
})

export const input_border = styleVariants({
  none: { border: 'none' },
  default: {
    border: `${theme.border} ${theme.vars.borderColor}`,
    borderRadius: theme.borderRadius,

    selectors: {
      '&:focus-within': {
        border: theme.color.focus,
      },
      '&.invalid': {
        border: theme.color.error,
      },
    },
  },
})
