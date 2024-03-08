import { theme } from '../../css/global.css'
import { styleVariants, style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import palette from '../../css/colors.css'
import { size } from '../../css/size.css'

const base = style({
  '@layer': {
    [app]: {
      position: 'relative',
      borderRadius: theme['default-border-radius'],
      height: theme['button-height'],
      cursor: 'pointer',
      outline: 'none',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
      padding: `0 ${size['size-3']}`,

      selectors: {
        '&:active': {
          backgroundImage: 'linear-gradient(rgb(0 0 0/40%) 0 0)',
        },
      },
    },
  },
})

export const button_content = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      alignItems: 'center',
      userSelect: 'none',
      zIndex: 0,
    },
  },
})

const buttonPalette = {
  primary: {
    '@layer': {
      [app]: {
        backgroundColor: palette['blue-7'],
        borderColor: 'unset',
        color: 'white',
        border: '1px solid',
      },
    },
  },
  primary_outline: {
    '@layer': {
      [app]: {
        backgroundColor: 'transparent',
        color: palette['blue-7'],
        border: '1px solid',
      },
    },
  },
  warning: {
    '@layer': {
      [app]: {
        backgroundColor: palette['yellow-7'],
        borderColor: 'unset',
        color: 'white',
        border: '1px solid',
      },
    },
  },
  warning_outline: {
    '@layer': {
      [app]: {
        backgroundColor: 'transparent',
        color: palette['yellow-7'],
        border: '1px solid',
      },
    },
  },
  default: {
    '@layer': {
      [app]: {
        backgroundColor: palette['gray-6'],
        borderColor: 'unset',
        color: 'white',
        border: '1px solid',
      },
    },
  },
  default_outline: {
    '@layer': {
      [app]: {
        backgroundColor: 'transparent',
        color: palette['gray-6'],
        border: '1px solid',
      },
    },
  },
  danger: {
    '@layer': {
      [app]: {
        backgroundColor: palette['red-7'],
        borderColor: 'unset',
        color: 'white',
        border: '1px solid',
      },
    },
  },
  danger_outline: {
    '@layer': {
      [app]: {
        backgroundColor: 'transparent',
        color: palette['red-7'],
        border: '1px solid',
      },
    },
  },
  update: {
    '@layer': {
      [app]: {
        backgroundColor: palette['teal-7'],
        borderColor: 'unset',
        color: 'white',
        border: '1px solid',
      },
    },
  },
  update_outline: {
    '@layer': {
      [app]: {
        backgroundColor: 'transparent',
        color: palette['teal-7'],
        border: '1px solid',
      },
    },
  },
  unstyled: {
    '@layer': {
      [app]: {
        backgroundColor: 'transparent',
        color: theme.vars['app-color'],
        border: 'none',
        padding: 'unset',
      },
    },
  },
}

export const button = styleVariants(buttonPalette, (paletteColor) => [
  base,
  paletteColor,
])
