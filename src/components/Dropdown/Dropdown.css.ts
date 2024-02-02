import { theme } from '../../css/global.css'
import { app } from '../../css/layers.css'
import { style, globalStyle } from '@vanilla-extract/css'

export const dropdown = style({
  '@layer': {
    [app]: {
      position: 'relative',
      width: theme['input-width'],
      color: theme.vars['app-color'],
    },
  },
})

export const dropdown_wrapper = style({
  '@layer': {
    [app]: {
      position: 'relative',
      width: 'inherit',
    },
  },
})

export const dropdown_label = style({
  '@layer': {
    [app]: {
      fontWeight: theme['input-label-font-weight'],
    },
  },
})

export const dropdown_label_required = style({
  '@layer': {
    [app]: {
      color: 'red',
      margin: '.25rem',
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
    },
  },
})

export const invalid = style({
  '@layer': {
    [app]: {
      selectors: {
        [`${dropdown_container} &`]: {
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
        '&:focus': {
          outline: 'none',
        },
        [`${invalid} &`]: {
          color: theme.vars.input['input-error-color'],
        },
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
      overflowY: 'auto',
      zIndex: 1000,
      backgroundColor: theme.vars['app-background-color'],
      color: theme.vars['app-color'],
      boxShadow: '0px 8px 16px 0px rgba(0,0,0,0.2)',
      listStyle: 'none',
      padding: '0 .25rem',
      border: theme.vars['app-border-line-style'],
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
      width: '5rem',
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
