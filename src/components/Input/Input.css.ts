import { theme } from '../../css/global.css'
import { style, globalStyle } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

export const input_wrapper = style({
  '@layer': {
    [app]: {
      width: theme['input-width'],
      color: theme.vars['app-color'],
      height: 'fit-content',
    },
  },
})

export const input_label = style({
  '@layer': {
    [app]: {
      fontWeight: theme['input-label-font-weight'],
    },
  },
})

export const input_label_required = style({
  '@layer': {
    [app]: {
      color: 'red',
      margin: '.25rem',
    },
  },
})

export const input_container = style({
  '@layer': {
    [app]: {
      position: 'relative',
      border: theme['input-border'],
      borderRadius: theme['default-border-radius'],
      height: theme['input-height'],
      selectors: {
        '&:has(:focus)': {
          outline: theme.vars['focus-border'],
        },
      },
    },
  },
})

export const input_error_message = style({
  '@layer': {
    [app]: {
      color: theme.vars.input['input-error-color'],
      fontSize: 'small',
    },
  },
})

export const invalid = style({
  '@layer': {
    [app]: {
      selectors: {
        [`${input_container} &`]: {
          borderColor: theme.vars.input['input-error-color'],
        },
      },
    },
  },
})

export const input_left_section = style({
  '@layer': {
    [app]: {
      zIndex: '1',
      position: 'absolute',
      top: '0',
      left: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '2rem',
      height: '100%',
    },
  },
})

export const input_right_section = style({
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

export const input = style({
  '@layer': {
    [app]: {
      position: 'relative',
      border: 'none',
      backgroundColor: 'transparent',
      padding: '0 .75rem',
      width: '100%',
      height: '100%',
      color: theme.vars['app-color'],

      selectors: {
        '&:focus': {
          outline: 'none',
        },
        [`${invalid} &`]: {
          color: theme.vars.input['input-error-color'],
        },
        [`${input_container}:has(${input_left_section}) > &`]: {
          paddingLeft: '2rem',
        },
        [`${input_container}:has(${input_right_section}) > &`]: {
          paddingRight: '2rem',
        },
      },
    },
  },
})

globalStyle(`${input_left_section} > span`, {
  '@layer': {
    [app]: {
      display: 'inline-block',
      maxHeight: 'fit-content',
    },
  },
})

globalStyle(`${input_right_section} > span`, {
  '@layer': {
    [app]: {
      display: 'inline-block',
      maxHeight: 'fit-content',
    },
  },
})

globalStyle('.input_label > span > *', {
  '@layer': {
    [app]: {
      transform: 'scale(1.5)',
    },
  },
})
