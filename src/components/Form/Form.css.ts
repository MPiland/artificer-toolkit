import { style, globalStyle } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'
import { theme } from '../../css/global.css'
import palette from '../../css/colors.css'

export const form_wrapper = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'flexDirection': 'column',
      'position': 'relative',
      'height': '100%',
      'width': 'inherit',
      'overflow': 'hidden',
      'borderLeft': theme.vars['app-border-line-style'],
      'borderRight': theme.vars['app-border-line-style'],

      '@media': {
        'screen and (max-width: 567px)': {
          border: 'none',
        },
      },
    },
  },
})

export const form_header = style({
  '@layer': {
    [app]: {
      paddingTop: size['size-1'],
      marginBottom: size['size-1'],
      paddingLeft: '1rem',
      paddingRight: '1rem',
    },
  },
})

export const form_content = style({
  '@layer': {
    [app]: {
      position: 'relative',
      paddingLeft: '1rem',
      paddingRight: '1rem',
      height: '100%',
    },
  },
})

export const form_footer = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      alignItems: 'center',
      paddingLeft: '.75rem',
      paddingRight: '.75rem',
      left: 0,
      bottom: 0,
      width: '100%',
      borderTop: theme.vars['app-border-line-style'],
      backgroundColor: theme.vars['app-background-color'],
      padding: '.5rem .5rem',
    },
  },
})

export const feature_list = style({
  '@layer': {
    [app]: {
      width: '80%',
      marginLeft: '10%',
      marginTop: '2rem',
    },
  },
})

export const feature_card = style({
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

export const feature_description = style({
  height: '100%',
})

export const form_remove_button = style({
  '@layer': {
    [app]: {
      width: '1.5rem',
      height: '1.5rem',
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

export const form_add_button = style({
  '@layer': {
    [app]: {
      width: '1.5rem',
      height: '1.5rem',
      border: theme.vars['app-border-line-style'],
      borderColor: palette['blue-5'],
      color: palette['blue-5'],
      borderRadius: '.5rem',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette['blue-2'],

      selectors: {
        '&:hover': {
          backgroundColor: palette['blue-7'],
          borderColor: palette['blue-9'],
          color: theme.vars['app-background-color'],
        },
      },
    },
  },
})

export const error_message = style({
  '@layer': {
    [app]: {
      color: palette['red-6'],
    },
  },
})

export const success_message = style({
  '@layer': {
    [app]: {
      color: palette['green-6'],
    },
  },
})

globalStyle(`${form_remove_button} svg`, {
  '@layer': {
    [app]: {
      strokeWidth: '3px',
    },
  },
})

globalStyle(`${form_add_button} svg`, {
  '@layer': {
    [app]: {
      strokeWidth: '3px',
    },
  },
})
