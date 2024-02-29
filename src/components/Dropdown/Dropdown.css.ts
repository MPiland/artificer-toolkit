import { theme } from '../../css/global.css'
import { app } from '../../css/layers.css'
import { style, globalStyle } from '@vanilla-extract/css'

export const dropdown = style({
  '@layer': {
    [app]: {
      position: 'relative',
      width: theme['input-width'],
      color: theme.vars['app-color'],

      selectors: {
        '&:has(:focus-within)': {
          outline: 'none',
        },
      },
    },
  },
})

export const dropdown_wrapper = style({
  '@layer': {
    [app]: {
      position: 'relative',
      width: 'inherit',
      overflow: 'hidden',
      textWrap: 'nowrap',
      textOverflow: 'ellipsis',

      selectors: {
        '&:has(:focus-within)': {
          outline: 'none',
        },
      },
    },
  },
})

export const dropdown_label = style({
  '@layer': {
    [app]: {
      fontWeight: theme['input-label-font-weight'],

      selectors: {
        '&.required:after': {
          content: '*',
          color: 'red',
          right: 0,
        },
      },
    },
  },
})

export const dropdown_container = style({
  '@layer': {
    [app]: {
      position: 'relative',
      border: theme['input-border'],
      borderRadius: theme['default-border-radius'],
      height: theme['input-height'],
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: '.75rem',
      overflow: 'hidden',
      cursor: 'pointer',

      selectors: {
        '&.invalid': {
          borderColor: theme.vars.input['input-error-color'],
        },
      },
    },
  },
})

export const dropdown_right_section = style({
  '@layer': {
    [app]: {
      zIndex: '1',
      position: 'absolute',
      top: '0',
      right: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '2rem',
      height: '100%',
    },
  },
})

export const dropdown_input = style({
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
        [`${dropdown_container}:has(${dropdown_right_section}) > &`]: {
          paddingRight: '2rem',
        },
      },
    },
  },
})

export const dropdown_menu = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '10rem',
      borderRadius: theme['default-border-radius'],
      zIndex: 1000,
      backgroundColor: theme.vars['app-background-color'],
      color: theme.vars['app-color'],
      boxShadow: '0px 8px 16px 0px rgba(0,0,0,0.2)',
      listStyle: 'none',
      padding: '.25rem',
      border: theme.vars['app-border-line-style'],
      height: 'fit-content',
    },
  },
})

export const dropdown_option = style({
  '@layer': {
    [app]: {
      cursor: 'default',
      padding: '.25rem .25rem',
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

export const dropdown_option_right_side = style({
  width: '1rem',
  marginLeft: '.5rem',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'row',
})

export const dropdown_active_option = style({
  '@layer': {
    [app]: {
      backgroundImage: 'linear-gradient(rgb(0 0 0/10%) 0 0)',
      borderRadius: '.75rem',
      border: theme.vars['app-border-line-style'],
      width: 'fit-content',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      padding: '.125rem .5rem',
      whiteSpace: 'nowrap',
    },
  },
})

globalStyle(`${dropdown_right_section} > span`, {
  '@layer': {
    [app]: {
      display: 'inline-block',
      maxHeight: 'fit-content',
    },
  },
})
