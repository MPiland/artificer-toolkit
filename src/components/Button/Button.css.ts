import { theme } from '../../css/global.css'
import { styleVariants, style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

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

const palette = {
  primary: {
    '@layer': {
      [app]: {
        backgroundColor: theme.vars.button.color.primary,
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
        borderColor: theme.vars.button.color.primary,
        color: theme.vars.button.color.primary,
        border: '1px solid',
      },
    },
  },
  warning: {
    '@layer': {
      [app]: {
        backgroundColor: theme.vars.button.color.warning,
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
        borderColor: theme.vars.button.color.warning,
        color: theme.vars.button.color.warning,
        border: '1px solid',
      },
    },
  },
  default: {
    '@layer': {
      [app]: {
        backgroundColor: theme.vars.button.color.default,
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
        borderColor: theme.vars.button.color.default,
        color: theme.vars.button.color.default,
        border: '1px solid',
      },
    },
  },
  danger: {
    '@layer': {
      [app]: {
        backgroundColor: theme.vars.button.color.danger,
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
        borderColor: theme.vars.button.color.danger,
        color: theme.vars.button.color.danger,
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

export const button = styleVariants(palette, (paletteColor) => [
  base,
  paletteColor,
])
