import { createVar, globalStyle, style } from '@vanilla-extract/css'
import { theme } from '../../css/global.css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'
import palette from '../../css/colors.css'

export const height = createVar('height')

export const accordion = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      height: 'auto',
    },
  },
})

export const accordion_container = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: 'auto',
      borderRadius: theme['default-border-radius'],
      border: theme.vars['app-border-line-style'],
      marginBottom: size['size-2'],
      boxShadow: '-2px 2px 4px 0px rgba(0,0,0,0.2)',
    },
  },
})

export const accordion_header = style({
  display: 'flex',
  flexDirection: 'row',
  borderBottom: theme.vars['app-border-line-style'],
  padding: '.5rem 1rem',
  cursor: 'pointer',

  selectors: {
    '&.collapsed': {
      borderBottom: 'none',
    },
  },
})

export const accordion_content = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '.5rem 1rem',

      selectors: {
        '&.collapsed': {
          padding: '0 1rem',
        },
      },
    },
  },
})

export const accordion_header_button = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: '1.25rem',
      alignItems: 'center',
      display: 'flex',
    },
  },
})

export const accordion_close_button = style({
  '@layer': {
    [app]: {
      width: '1.5rem',
      height: '1.5rem',
      border: theme.vars['app-border-line-style'],
      borderRadius: '.5rem',

      selectors: {
        '&:hover': {
          backgroundColor: palette['gray-3'],
        },
      },
    },
  },
})

globalStyle(`${accordion_header_button} > svg`, {
  width: '100%',
  height: 'auto',
})
