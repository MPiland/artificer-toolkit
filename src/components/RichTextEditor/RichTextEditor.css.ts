import { theme } from '../../css/global.css'
import { globalStyle, style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const editor_container = style({
  '@layer': {
    [app]: {
      'borderRadius': theme['default-border-radius'],
      'border': theme.vars['app-border-line-style'],
      'overflow': 'hidden',
      'resize': 'vertical',
      'backgroundColor': 'transparent',
      'display': 'flex',
      'flexDirection': 'column',

      'selectors': {
        '&:focus-within': {
          outline: theme.vars['focus-border'],
        },
      },

      '@media': {
        'screen and (max-width: 1023px)': {
          resize: 'none',
        },
      },
    },
  },
})

export const editor_label = style({
  '@layer': {
    [app]: {
      fontWeight: theme['input-label-font-weight'],
    },
  },
})

export const editor_menu_bar = style({
  '@layer': {
    [app]: {
      display: 'flex',
      borderBottom: theme.vars['app-border-line-style'],
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
      padding: '.5rem',
      maxHeight: '12rem',
    },
  },
})

export const editor_content = style({
  '@layer': {
    [app]: {
      outline: 'none',
      height: '100%',
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
      borderTop: theme.vars['app-border-line-style'],
      borderBottom: theme.vars['app-border-line-style'],
      borderRight: theme.vars['app-border-line-style'],
      borderLeft: theme.vars['app-border-line-style'],
      backgroundColor: theme.vars['app-background-color'],
      cursor: 'pointer',

      selectors: {
        [`${editor_button_group} > &:first-of-type`]: {
          borderTopLeftRadius: theme['default-border-radius'],
          borderBottomLeftRadius: theme['default-border-radius'],
        },
        [`${editor_button_group} > &:last-of-type`]: {
          borderTopRightRadius: theme['default-border-radius'],
          borderBottomRightRadius: theme['default-border-radius'],
        },
        '&.active': {
          filter: 'invert(1)',
        },
      },
    },
  },
})

export const editor_table = style({
  '@layer': {
    [app]: {
      borderCollapse: 'collapse',
      margin: '0',
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
      border: theme.vars['app-border-line-style'],
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
      border: theme.vars['app-border-line-style'],
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
      margin: '0',
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

globalStyle(`${editor_content} blockquote`, {
  '@layer': {
    [app]: {
      borderRadius: theme['default-border-radius'],
      border: theme.vars['app-border-line-style'],
      marginLeft: size['size-3'],
      marginTop: size['size-2'],
      padding: size['size-1'],
    },
  },
})
