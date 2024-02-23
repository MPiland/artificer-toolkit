import { style, globalStyle } from '@vanilla-extract/css'
import { theme } from '../../css/global.css'
import { size } from '../../css/size.css'
import { app } from '../../css/layers.css'
import palette from '../../css/colors.css'

export const card = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: 'auto',
      borderRadius: theme['default-border-radius'],
      border: theme.vars['app-border-line-style'],
      marginBottom: size['size-2'],
      boxShadow: '-2px 2px 4px 0px rgba(0,0,0,0.2)',
      padding: '1rem 1rem',
    },
  },
})

export const card_close_button = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      width: '2rem',
      height: '2rem',
      border: theme.vars['app-border-line-style'],
      borderColor: palette['red-5'],
      color: palette['red-5'],
      borderRadius: '.5rem',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette['red-2'],

      selectors: {
        '&:hover': {
          backgroundColor: palette['red-7'],
          borderColor: palette['red-9'],
          color: theme.vars['app-background-color'],
        },
      },
    },
  },
})

globalStyle(`${card_close_button} svg`, {
  '@layer': {
    [app]: {
      strokeWidth: '3px',
    },
  },
})
