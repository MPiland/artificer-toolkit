import { theme } from '../../css/theme'
import { globalStyle, style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const editor_container = style({
  '@layer': {
    [app]: {
      'overflow': 'hidden',
      'resize': 'vertical',
      'backgroundColor': 'transparent',
      'display': 'flex',
      'flexDirection': 'column',
      'width': '100%',

      '@media': {
        'screen and (max-width: 1024px)': {
          resize: 'none',
        },
      },
    },
  },
})

export const editor_menu_bar = style({
  '@layer': {
    [app]: {
      display: 'flex',
      width: '100%',
      minHeight: '3rem',
      flexWrap: 'wrap',
      height: 'fit-content',
    },
  },
})

export const editor_content_container = style({
  '@layer': {
    [app]: {
      position: 'relative',
      padding: `0 ${size['size-4']}`,
      maxHeight: '12rem',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '6rem',
    },
  },
})

export const editor_content = style({
  '@layer': {
    [app]: {
      outline: 'none',
      height: '100%',
      flex: 1,
      padding: '1rem 0',
    },
  },
})

export const editor_button_group = style({
  '@layer': {
    [app]: {
      margin: '.5rem .5rem',
      display: 'inline-flex',
    },
  },
})

export const editor_button = style({
  '@layer': {
    [app]: {
      padding: '0 .25rem',
      width: '1.875rem',
      display: 'flex',
      alignItems: 'center',
      border: `${theme.other?.border.width.thin} ${theme.other?.border.style} ${theme.other?.border.color}`,
      cursor: 'pointer',

      selectors: {
        [`${editor_button_group} > &:first-of-type`]: {
          borderTopLeftRadius: theme.defaultRadius,
          borderBottomLeftRadius: theme.defaultRadius,
        },
        [`${editor_button_group} > &:last-of-type`]: {
          borderTopRightRadius: theme.defaultRadius,
          borderBottomRightRadius: theme.defaultRadius,
        },
        '&.active': {
          filter: 'invert(1)',
        },
      },
    },
  },
})

export const editor_blockquote = style({
  '@layer': {
    [app]: {
      borderRadius: theme.defaultRadius,
      border: `${theme.other?.border.width.thin} ${theme.other?.border.style} ${theme.other?.border.color}`,
      marginLeft: size['size-3'],
      marginTop: size['size-3'],
      padding: size['size-1'],
    },
  },
})

export const editor_table = style({
  '@layer': {
    [app]: {
      borderCollapse: 'collapse',
      overflow: 'hidden',
      tableLayout: 'fixed',
      width: '90%',
      backgroundColor: 'transparent',
    },
  },
})

export const editor_table_th = style({
  '@layer': {
    [app]: {
      border: `${theme.other?.border.width.thin} ${theme.other?.border.style} ${theme.other?.border.color}`,
      backgroundColor: 'lightgrey',
      borderBottomWidth: '2px',
      fontWeight: 'bold',
      textAlign: 'left',
      padding: '3px 5px',
      verticalAlign: 'top',
      minWidth: '1rem',
    },
  },
})

export const editor_table_td = style({
  '@layer': {
    [app]: {
      border: `${theme.other?.border.width.thin} ${theme.other?.border.style} ${theme.other?.border.color}`,
      padding: '3px 5px',
      verticalAlign: 'top',
      backgroundColor: 'inherit',
      width: 'auto',
    },
  },
})

globalStyle(`${editor_table_th} > p`, {
  '@layer': {
    [app]: {
      width: 'fit-content',
    },
  },
})

globalStyle('.tableWrapper > table', {
  '@layer': {
    [app]: {
      width: '100%',
    },
  },
})

globalStyle(`${editor_button} > svg`, {
  '@layer': {
    [app]: {
      width: '100%',
      height: 'auto',
    },
  },
})

globalStyle('.ProseMirror table', {
  '@layer': {
    [app]: {
      borderCollapse: 'collapse',
      margin: `${size['size-3']} 0`,
      overflow: 'hidden',
      tableLayout: 'fixed',
    },
  },
})

globalStyle('table .selectedCell:after', {
  '@layer': {
    [app]: {
      background: 'rgba(200, 200, 255, 0.4)',
      content: '',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 2,
    },
  },
})

globalStyle('.resize-cursor', {
  '@layer': {
    [app]: {
      cursor: ['ew-resize', 'col-resize'],
      zIndex: '10',
    },
  },
})

globalStyle(`${editor_content} blockquote`, {})
