import { globalStyle, style } from '@vanilla-extract/css'
import { theme } from '../../css/theme.css'
import { app } from '../../css/layers.css'
import { size, space } from '../../css/size.css'

export const detail_nav_section = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 .5rem',
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
      marginBottom: '.5rem',
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

globalStyle(`${detail_body} tr`, {
  '@layer': {
    [app]: {
      borderBottom: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
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
      borderRadius: theme.border.radius,
      border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
      marginLeft: size['size-3'],
      marginTop: size['size-2'],
      padding: size['size-1'],
    },
  },
})
