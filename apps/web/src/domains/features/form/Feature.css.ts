import { style, globalStyle } from '@vanilla-extract/css'
import { app } from '@css/layers.css'
import { space } from '@css/size.css'
import { vars } from '@css/theme'

export const list_button_container = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      paddingTop: space['space-4'],
    },
  },
})

export const list = style({
  '@layer': {
    [app]: {
      width: '100%',
    },
  },
})

export const description = style({
  height: '100%',
})

export const option_card = style({
  '@layer': {
    [app]: {
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      minHeight: '160px',

      selectors: {
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: vars.shadows.md,
        },
      },
    },
  },
})

export const add_option_card = style({
  '@layer': {
    [app]: {
      borderStyle: 'dashed',
      borderColor: vars.colors.gray[4],
      cursor: 'pointer',
      minHeight: '160px',
      transition: 'all 0.2s ease',

      selectors: {
        '&:hover': {
          borderColor: vars.colors.blue[4],
          backgroundColor: vars.colors.blue[0],
        },
      },
    },
  },
})

globalStyle(`${description} p:last-of-type`, {
  '@layer': {
    [app]: {
      marginBottom: 0,
    },
  },
})
