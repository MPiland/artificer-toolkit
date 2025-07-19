import { style, globalStyle } from '@vanilla-extract/css'
import { app } from '@/css/layers.css'
import { space } from '@/css/size.css'

export const list_button_container = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      paddingTop: space['space-4'],
    },
  },
})

export const list = style({
  '@layer': {
    [app]: {
      width: '100%',
    },
  },
})

export const description = style({
  height: '100%',
})

globalStyle(`${description} p:last-of-type`, {
  '@layer': {
    [app]: {
      marginBottom: 0,
    },
  },
})
