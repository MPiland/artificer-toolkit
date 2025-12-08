import { app } from '~css/layers.css'
import {style } from '@vanilla-extract/css'
import { size, space } from '~css/size.css'

export const base = style({
  '@layer': {
    [app]: {
      vars: {
        '--input-asterisk-color': 'red',
      },
    },
  },
  'zIndex': 1000,
})

export const label = style({
  '@layer': {
    [app]: {
      marginBottom: space['space-2'],
    },
  },
})

export const wrapper = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      cursor: 'pointer',
    },
  },
})

export const input = style({
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

export const icon = style({
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

export const active_icon = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      height: size['size-4'],
      width: size['size-4'],
    },
  },
})

export const combobox_option = style({
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
