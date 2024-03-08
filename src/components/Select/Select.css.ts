import { style } from '@vanilla-extract/css'
import { theme } from '../../css/global.css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const select = style({
  '@layer': {
    [app]: {
      position: 'relative',
      width: theme['input-width'],
      color: theme.vars['app-color'],
    },
  },
})

export const select_wrapper = style({
  '@layer': {
    [app]: {
      width: theme['input-width'],
      color: theme.vars['app-color'],
      height: 'fit-content',
      display: 'flex',
      flexDirection: 'column',
    },
  },
})

export const select_label = style({
  '@layer': {
    [app]: {
      fontWeight: theme['input-label-font-weight'],
    },
  },
})

export const select_container = style({
  '@layer': {
    [app]: {
      position: 'relative',
      border: theme['input-border'],
      borderRadius: theme['default-border-radius'],
      height: theme['input-height'],
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: size['size-3'],
      overflow: 'hidden',
      cursor: 'pointer',
    },
  },
})

export const select_input = style({
  '@layer': {
    [app]: {
      position: 'relative',
      border: 'none',
      backgroundColor: 'transparent',
      width: '100%',
      color: theme.vars['app-color'],
      userSelect: 'none',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      overflow: 'hidden',
      whiteSpace: 'nowrap',

      selectors: {
        '&:focus': {
          outline: 'none',
        },
      },
    },
  },
})

export const select_menu = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '10rem',
      borderRadius: theme['default-border-radius'],
      overflowY: 'auto',
      zIndex: 1000,
      backgroundColor: theme.vars['app-background-color'],
      color: theme.vars['app-color'],
      boxShadow: '0px 8px 16px 0px rgba(0,0,0,0.2)',
      listStyle: 'none',
      border: theme.vars['app-border-line-style'],
      padding: `${size['size-0']} ${size['size-0']}`,
    },
  },
})

export const select_option = style({
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
        '&:hover': {
          backgroundColor: 'rgb(118, 184, 255)',
        },
      },
    },
  },
})
