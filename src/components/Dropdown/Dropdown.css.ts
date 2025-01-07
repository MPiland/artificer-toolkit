import { app } from '../../css/layers.css'
import { style, globalStyle, styleVariants } from '@vanilla-extract/css'
import { size, space } from '../../css/size.css'
import { theme } from '../../css/theme.css'

export const dropdown = style({
  '@layer': {
    [app]: {
      position: 'relative',

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
      marginBottom: space['space-2'],
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
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: size['size-3'],
      overflow: 'hidden',
      cursor: 'pointer',
      borderRadius: theme.border.radius,
      backgroundColor: theme.vars.component.input.backgroundColor,
      color: theme.vars.typography.color.main,

      selectors: {
        '&:focus-within': {
          border: `${theme.border.size.emphasis} ${theme.border.style} ${theme.vars.component.input.border.color.focus}`,
        },
        '&.invalid': {
          border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.input.border.color.error}`,
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
      width: size['size-9'],
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
      width: 'auto',
      userSelect: 'none',
      flexWrap: 'nowrap',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',

      selectors: {
        [`${dropdown_container}:has(${dropdown_right_section}) > &`]: {
          marginRight: '2rem',
        },
        '&.multiselect': {
          display: 'flex',
          flexDirection: 'row',
        },
      },
    },
  },
})

export const dropdown_menu = style({
  '@layer': {
    [app]: {
      display: 'flex',
      maxHeight: '10rem',
      zIndex: 1000,
      boxShadow: '0px 8px 16px 0px rgba(0,0,0,0.2)',
      listStyle: 'none',
      padding: `${size['size-0']} ${size['size-0']}`,
      height: 'fit-content',
      backgroundColor: theme.vars.component.input.backgroundColor,
      border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.input.border.color.main}`,
      borderRadius: theme.border.radius,
    },
  },
})

export const dropdown_option = style({
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
          borderRadius: theme.border.radius,
        },
        '&:hover': {
          backgroundColor: 'rgb(118, 184, 255)',
          borderRadius: theme.border.radius,
        },
      },
    },
  },
})

export const dropdown_option_right_side = style({
  width: '1rem',
  marginLeft: size['size-2'],
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'row',
})

export const dropdown_active_option = style({
  '@layer': {
    [app]: {
      backgroundImage: 'linear-gradient(rgb(0 0 0/10%) 0 0)',
      borderRadius: '.75rem',
      width: 'fit-content',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      padding: `${size['size-0']} ${size['size-2']}`,
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

export const dropdown_height = styleVariants({
  auto: { height: size['size-auto'] },
  full: { height: size['size-full'] },
  default: { height: theme.component.input.height },
})

export const dropdown_border = styleVariants({
  none: { border: 'none' },
  default: {
    border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.input.border.color.main}`,
    selectors: {
      '&:focus-within': {
        border: `${theme.border.size.emphasis} ${theme.border.style} ${theme.vars.component.input.border.color.focus}`,
      },
      '&.invalid': {
        border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.input.border.color.error}`,
      },
    },
  },
})
