import { style } from '@vanilla-extract/css'
import { theme } from '../../css/theme.css'
import { app } from '../../css/layers.css'
import { size, space } from '../../css/size.css'

export const select_wrapper = style({
  '@layer': {
    [app]: {
      position: 'relative',
      textWrap: 'nowrap',
      textOverflow: 'ellipsis',
    },
  },
})

export const select_label = style({
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

export const select_container = style({
  '@layer': {
    [app]: {
      position: 'relative',
      fontSize: 'inherit',
      padding: '0 .75rem',
      borderRadius: theme.border.radius,
      backgroundColor: theme.vars.component.input.backgroundColor,
      border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.input.border.color.main}`,
      height: theme.component.input.height,
    },
  },
})

export const select_input = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
      width: '100%',
      height: '100%',
      fontSize: 'inherit',
      fontWeight: 'inherit',
      border: 'none',
      color: theme.vars.typography.color.main,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
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
      borderRadius: theme.border.radius,
      overflowY: 'auto',
      zIndex: 1000,
      backgroundColor: theme.vars.component.content.backgroundColor.main,
      color: theme.vars.typography.color.main,
      boxShadow: '0px 8px 16px 0px rgba(0,0,0,0.2)',
      listStyle: 'none',
      border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
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
