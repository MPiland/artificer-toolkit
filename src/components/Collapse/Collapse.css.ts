import { theme } from '../../css/global.css'
import { app } from '../../css/layers.css'
import { style } from '@vanilla-extract/css'
import { size } from '../../css/size.css'
import palette from '../../css/colors.css'

export const collapse_wrapper = style({
  '@layer': {
    [app]: {
      position: 'relative',
      border: theme.vars['app-border-line-style'],
      borderRadius: theme['default-border-radius'],
      backgroundColor: theme.vars['app-background-color'],
      zIndex: 2,
    },
  },
})

export const collapse_body = style({
  '@layer': {
    [app]: {
      display: 'grid',
      borderSpacing: 0,
      gridTemplateRows: '1fr',
      transition: 'grid-template-rows 0.3s ease-in-out',

      selectors: {
        '&.collapsed': {
          gridTemplateRows: '0fr',
        },
      },
    },
  },
})

export const collapse_content = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: 'auto',
      overflow: 'hidden',
      padding: `${size['size-3']} ${size['size-3']}`,
      transition: 'padding 0.3s ease-in-out',

      selectors: {
        '&.collapsed': {
          padding: `0 ${size['size-3']}`,
        },
      },
    },
  },
})

export const collapse_header = style({
  '@layer': {
    [app]: {
      borderBottom: theme.vars['app-border-line-style'],
      borderBottomLeftRadius: '0',
      borderBottomRightRadius: '0',
      borderTopLeftRadius: theme['default-border-radius'],
      borderTopRightRadius: theme['default-border-radius'],
      width: '100%',
      fontWeight: 'bold',
      backgroundColor: theme.vars['app-background-color'],
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'start',
      cursor: 'pointer',
      padding: `${size['size-2']} ${size['size-3']}`,

      selectors: {
        '&.collapsed': {
          border: 'none',
          borderBottomLeftRadius: theme['default-border-radius'],
          borderBottomRightRadius: theme['default-border-radius'],
        },
      },
    },
  },
})

export const collapse_header_button = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: '1.25rem',
      alignItems: 'center',
      display: 'flex',
    },
  },
})

export const collapse_remove_button = style({
  '@layer': {
    [app]: {
      width: '1.5rem',
      height: '1.5rem',
      border: theme.vars['app-border-line-style'],
      borderRadius: '.5rem',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: size['size-1'],

      selectors: {
        '&:hover': {
          backgroundColor: palette['gray-3'],
        },
      },
    },
  },
})
