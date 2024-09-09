import { style } from '@vanilla-extract/css'
import { theme } from '../../css/theme.css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const select = style({
  '@layer': {
    [app]: {
      position: 'relative',
      color: theme.vars.backgroundColor.component,
    },
  },
})

export const select_wrapper = style({
  '@layer': {
    [app]: {
      color: theme.vars.color,
      height: 'fit-content',
      display: 'flex',
      flexDirection: 'column',
    },
  },
})

export const select_container = style({
  '@layer': {
    [app]: {
      position: 'relative',
      borderBottom: `${theme.border} ${theme.vars.borderColor}`,
      borderRight: `${theme.border} ${theme.vars.borderColor}`,
      borderBottomRightRadius: theme.borderRadius,
      height: theme.input.height,
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
      color: theme.vars.color,
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
      maxHeight: '10rem',
      borderRadius: theme.borderRadius,
      overflowY: 'auto',
      zIndex: 1000,
      backgroundColor: theme.vars.backgroundColor.content,
      color: theme.vars.color,
      boxShadow: '0px 8px 16px 0px rgba(0,0,0,0.2)',
      listStyle: 'none',
      border: `${theme.border} ${theme.vars.borderColor}`,
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
