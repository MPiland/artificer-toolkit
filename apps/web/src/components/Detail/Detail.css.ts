import { globalStyle, style } from '@vanilla-extract/css'
import { app } from '@css/layers.css'
import { size, space } from '@css/size.css'

export const detail_link = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: space['space-2'],
      textDecoration: 'none',
      padding: space['space-2'],
    },
  },
})

export const detail_link_icon = style({
  '@layer': {
    [app]: {
      width: size['size-4'],
      height: size['size-4'],
    },
  },
})

export const detail_title = style({
  '@layer': {
    [app]: {
      padding: '1rem .5rem',
    },
  },
})

export const detail_col_section = style({
  '@layer': {
    [app]: {
      position: 'relative',
      zIndex: 1,
      padding: '1rem .5rem',
      flex: '1 1 0',
    },
  },
})

export const detail_body = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      padding: '1rem .5rem',
    },
  },
})

export const detail_col_item = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      padding: '.5rem .5rem',
    },
  },
})

export const detail_col_title = style({
  '@layer': {
    [app]: {
      fontWeight: 'bold',
      marginBottom: space['space-2'],
    },
  },
})

export const detail_footer = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'end',
      alignItems: 'center',
    },
  },
})

globalStyle(`${detail_body} td`, {
  '@layer': {
    [app]: {
      padding: `${space['space-2']} ${space['space-0']}`,
    },
  },
})

globalStyle(`${detail_body} td > p`, {
  '@layer': {
    [app]: {
      marginBottom: 'unset',
    },
  },
})

globalStyle(`${detail_body} th`, {
  '@layer': {
    [app]: {
      textAlign: 'start',
      padding: '0 .125rem',
    },
  },
})

globalStyle(`${detail_body} blockquote`, {
  '@layer': {
    [app]: {
      marginLeft: size['size-3'],
      marginTop: size['size-2'],
      padding: size['size-1'],
    },
  },
})
