import { globalStyle, style } from '@vanilla-extract/css'
import { fontSize, fontWeight } from '../../css/typography.css'
import { theme } from '../../css/theme.css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const detail_title = style({
  '@layer': {
    [app]: {
      fontWeight: fontWeight['font-weight-7'],
    },
  },
})

export const detail_main = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
    },
  },
})

export const detail_aside = style({
  '@layer': {
    [app]: {
      position: 'relative',
      height: '100%',
      width: '0',
      padding: '0',
      margin: '0',
      backgroundColor: theme.vars.backgroundColor.content,
      color: theme.vars.color,
      zIndex: 20,
      transition: 'all .3s ease-in-out',
      overflow: 'hidden',
      textWrap: 'nowrap',

      selectors: {
        '&.active': {
          width: '13rem',
          borderRight: `${theme.border} ${theme.vars.borderColor}`,
          transition: 'all .3s ease-in-out',
          paddingRight: '1rem',
          marginRight: '.5rem',
        },
      },
    },
  },
})

export const detail_body = style({
  '@layer': {
    [app]: {
      position: 'relative',
      zIndex: 1,
      padding: '0 .5rem',
      flex: '1 1 0',
    },
  },
})

export const detail_aside_title = style({
  '@layer': {
    [app]: {
      fontWeight: fontWeight['font-weight-7'],
      fontSize: fontSize['font-size-2'],
    },
  },
})

export const detail_aside_list = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      paddingLeft: '.75rem',
      listStyle: 'none',
      fontSize: fontSize['font-size-1'],
    },
  },
})

globalStyle(`${detail_aside_list} > li`, {
  '@layer': {
    [app]: {
      display: 'flex',
      fontSize: 'inherit',
    },
  },
})

globalStyle(`${detail_aside_list} > li.active::before`, {
  '@layer': {
    [app]: {
      position: 'relative',
      content: '',
      width: '.5rem',
      backgroundColor: 'lightgreen',
      marginRight: '.25rem',
    },
  },
})

globalStyle(`${detail_aside_list} > li > a`, {
  '@layer': {
    [app]: {
      fontSize: 'inherit',
      textDecoration: 'none',
      color: theme.vars.color,
    },
  },
})

globalStyle(`${detail_body} td`, {
  '@layer': {
    [app]: {
      verticalAlign: 'top',
      padding: '0 .125rem',
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
      borderRadius: theme.borderRadius,
      border: `${theme.border} ${theme.vars.borderColor}`,
      marginLeft: size['size-3'],
      marginTop: size['size-2'],
      padding: size['size-1'],
    },
  },
})
