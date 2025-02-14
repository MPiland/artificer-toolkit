import { style, styleVariants } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { theme } from '../../css/theme.css'
import { size, space } from '../../css/size.css'

export const input_wrapper = style({
  '@layer': {
    [app]: {
      position: 'relative',
      textWrap: 'nowrap',
      textOverflow: 'ellipsis',
    },
  },
})

export const input_label = style({
  '@layer': {
    [app]: {
      display: 'inline-block',
      marginBottom: space['space-2'],

      selectors: {
        '&.required:after': {
          content: '*',
          color: 'red',
          right: 0,
          transform: 'scale(1.5)',
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
      padding: '0 .75rem',
      borderRadius: theme.border.radius,
      backgroundColor: theme.vars.component.input.backgroundColor,
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

export const input_endAdornment = style({
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
      'color': theme.vars.typography.color.main,
      'overflow': 'hidden',
      'textOverflow': 'ellipsis',
      'whiteSpace': 'nowrap',

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
        '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active': {
          WebkitBoxShadow: `0 0 0 30px ${theme.vars.component.input.backgroundColor} inset !important`,
          WebkitTextFillColor: `${theme.vars.typography.color.main} !important`,
        },
      },
    },
  },
})

export const input_height = styleVariants({
  auto: { '@layer': { [app]: { height: size['size-auto'] } } },
  full: { '@layer': { [app]: { height: size['size-full'] } } },
  default: { '@layer': { [app]: { height: theme.component.input.height } } },
})

export const input_textAlign = styleVariants({
  center: { '@layer': { [app]: { textAlign: 'center' } } },
})

export const input_border = styleVariants({
  none: { '@layer': { [app]: { border: 'none' } } },
  default: {
    '@layer': {
      [app]: {
        border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.input.border.color.main}`,

        selectors: {
          '&:focus-within': {
            border: `${theme.border.size.emphasis} ${theme.border.style} ${theme.vars.component.input.border.color.focus}`,
          },
          '&.invalid': {
            border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.input.border.color.error}`,
          },
        },
      },
    },
  },
})
