import { theme } from '../../css/global.css'
import { app } from '../../css/layers.css'
import { style } from '@vanilla-extract/css'
import { size } from '../../css/size.css'

export const collapse_container = style({
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

export const collapse_wrapper = style({
  '@layer': {
    [app]: {
      display: 'grid',
      borderSpacing: 0,
      gridTemplateRows: '1fr',
      transition:
        'grid-template-rows 0.3s ease-in-out, margin 0.3s ease-in-out',
      padding: size['size-1'],

      selectors: {
        '&.collapsed': {
          gridTemplateRows: '0fr',
          margin: `-${size['size-1']} 0`,
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
    },
  },
})

export const collapse_button = style({
  '@layer': {
    [app]: {
      borderBottom: theme.vars['app-border-line-style'],
      borderBottomLeftRadius: '0',
      borderBottomRightRadius: '0',
      padding: '0.25rem 0',
      width: '100%',
      textAlign: 'center',
      fontWeight: 'bold',
      backgroundColor: theme.vars['app-background-color'],
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',

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

export const collapse_button_caret = style({
  '@layer': {
    [app]: {
      transform: 'rotate(180deg)',
      transition: 'all 0.3s ease-in-out',

      selectors: {
        '&.collapsed': {
          transform: 'rotate(0)',
          transition: 'all 0.3s ease-in-out',
        },
      },
    },
  },
})
