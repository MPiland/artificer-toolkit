import { theme } from '../../css/global.css'
import { styleVariants, style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import palette from '../../css/colors.css'

export const button_content = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      alignItems: 'center',
    },
  },
})

const base = style({
  '@layer': {
    [app]: {
      borderRadius: theme['default-border-radius'],
      height: theme['button-height'],
      padding: '0 1.125rem',
      cursor: 'pointer',
      outline: 'none',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',

      selectors: {
        '&:active': {
          backgroundImage: 'linear-gradient(rgb(0 0 0/40%) 0 0)',
        },
      },
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
        borderColor: palette['blue-7'],
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
        borderColor: palette['yellow-7'],
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
        borderColor: palette['gray-6'],
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
        borderColor: palette['red-7'],
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
        borderColor: palette['teal-7'],
        color: palette['teal-7'],
        border: '1px solid',
      },
    },
  },
  unstyled: {
    '@layer': {
      [app]: {
        backgroundColor: 'transparent',
        borderColor: 'unset',
        color: theme.vars['app-color'],
        border: 'none',
        padding: '0',
      },
    },
  },
}

export const button = styleVariants(buttonPalette, (paletteColor) => [
  base,
  paletteColor,
])
