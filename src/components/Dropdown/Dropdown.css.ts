import { app } from '@/css/layers.css'
import {style, styleVariants } from '@vanilla-extract/css'
import { size, space } from '@/css/size.css'

export const dropdown = style({
  '@layer': {
    [app]: {
      vars: {
        '--input-asterisk-color': 'red',
      },
    },
  },
  'zIndex': 1000,
})

export const dropdown_label = style({
  '@layer': {
    [app]: {
      marginBottom: space['space-2'],
    },
  },
})

export const dropdown_wrapper = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      vars: {
        '--input-asterisk-color': 'red',
      },
      cursor: 'pointer',
    },
  },
})

export const dropdown_input = style({
  '@layer': {
    [app]: {
      width: '100%',
      border: 'none',
      backgroundColor: 'transparent',
      userSelect: 'none',
      color: 'inherit',
      textAlign: 'left',
      paddingBlock: '1px',
      paddingInline: '2px',
    },
  },
})

export const dropdown_icon = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      opacity: 0.6,
      height: size['size-4'],
      width: size['size-4'],
      cursor: 'pointer',
    },
  },
})

export const dropdown_active_icon = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      height: size['size-4'],
      width: size['size-4'],
    },
  },
})

export const dropdown_option = style({
  '@layer': {
    [app]: {
      display: 'flex',
      cursor: 'default',
      padding: `${size['size-1']} ${size['size-3']}`,
      justifyContent: 'flex-start',
      alignItems: 'center',

      selectors: {
        '&[aria-selected="true"]': {
          outline: 'none',
          backgroundColor: 'rgb(118, 184, 255) !important',
        },
      },
    },
  },
})

export const dropdown_height = styleVariants({
  auto: { '@layer': { [app]: { height: size['size-auto'] } } },
  full: { '@layer': { [app]: { height: size['size-full'] } } },
})
