import { theme } from '../../css/theme.css'
import { app } from '../../css/layers.css'
import { globalStyle, style } from '@vanilla-extract/css'
import { size } from '../../css/size.css'

export const collapse_wrapper = style({
  '@layer': {
    [app]: {
      position: 'relative',
      border: theme.vars['app-border-line-style'],
      borderRadius: theme['default-border-radius'],
      backgroundColor: theme.vars['app-background-color'],
      boxShadow: '-2px 2px 4px 0px rgba(0,0,0,0.2)',
      zIndex: 0,
      marginBottom: size['size-3'],

      selectors: {
        '&.borderless': {
          border: 'none',
          borderRadius: '0',
          boxShadow: 'none',
        },
      },
    },
  },
})

export const collapse_header = style({
  '@layer': {
    [app]: {
      width: '100%',
      fontWeight: 'bold',
      backgroundColor: theme.vars['app-background-color'],
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      padding: `${size['size-1']} ${size['size-3']}`,
      height: '2.5rem',
      flexWrap: 'nowrap',
      borderBottom: theme.vars['app-border-line-style'],
      borderBottomLeftRadius: '0',
      borderBottomRightRadius: '0',
      borderTopLeftRadius: theme['default-border-radius'],
      borderTopRightRadius: theme['default-border-radius'],

      selectors: {
        [`${collapse_wrapper}.collapsed &`]: {
          border: 'none',
          borderBottomLeftRadius: theme['default-border-radius'],
          borderBottomRightRadius: theme['default-border-radius'],
        },
      },
    },
  },
})

export const collapse_header_group = style({
  '@layer': {
    [app]: {
      height: '100%',
    },
  },
})

export const collapse_header_left = style({
  '@layer': {
    [app]: {
      marginRight: size['size-3'],
    },
  },
})

export const collapse_header_right = style({
  '@layer': {
    [app]: {
      height: '100%',
      marginLeft: size['size-3'],
    },
  },
})

export const collapse_header_icon = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: 'auto',
      alignItems: 'center',
      display: 'flex',
      marginLeft: size['size-3'],
    },
  },
})

export const collapse_body = style({
  '@layer': {
    [app]: {
      display: 'grid',
      borderSpacing: 0,
      gridTemplateRows: '1fr',
      transition: 'grid-template-rows 0.2s ease-out',

      selectors: {
        [`${collapse_wrapper}.collapsed > &`]: {
          gridTemplateRows: '0fr',
        },
      },
    },
  },
})

export const collapse_content = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: 'auto',
      overflow: 'hidden',
      padding: `${size['size-3']} ${size['size-3']}`,
      transition: 'padding 0.2s ease-out',

      selectors: {
        [`${collapse_wrapper}.collapsed > ${collapse_body} > &`]: {
          padding: `0 ${size['size-3']}`,
        },
        [`${collapse_wrapper}.borderless > ${collapse_body} > &`]: {
          paddingLeft: '0',
          paddingRight: '0',
        },
      },
    },
  },
})

globalStyle(`${collapse_header_icon} svg`, {
  '@layer': {
    [app]: {
      height: '60%',
      width: 'auto',
    },
  },
})
