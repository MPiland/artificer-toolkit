import { style } from '@vanilla-extract/css'
import { app } from '../css/layers.css'
import { theme } from '../css/theme.css'
import { size } from '../css/size.css'

export const sidebar = style({
  '@layer': {
    [app]: {
      'gridArea': 'sidebar',
      'display': 'flex',
      'flexDirection': 'column',
      'justifyContent': 'space-between',
      'backgroundColor': theme.vars.component.appShell.sidebar.backgroundColor,
      'width': theme.component.appShell.sidebar.spacing.width.main,
      'transition': 'all .3s ease-in-out',
      'borderRight': `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
      'zIndex': 100,

      'selectors': {
        '&.collapsed': {
          width: theme.component.appShell.sidebar.spacing.width.collapsed,
          overflow: 'hidden',
        },
      },

      '@media': {
        'screen and (max-width: 1024px)': {
          position: 'fixed',
          top: theme.component.appShell.header.spacing.height,
          height: `calc(100% - ${theme.component.appShell.header.spacing.height})`,
          selectors: {
            '&.collapsed': {
              width: 0,
              border: 'none',
            },
          },
        },
      },
    },
  },
})

export const sidebar_upper = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
  },
})

export const sidebar_header = style({
  '@layer': {
    [app]: {
      width: '100%',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'end',
      alignItems: 'center',
      height: theme.component.appShell.sidebar.spacing.height.header,
      margin: `${size['size-4']} 0`,
      padding: `0 ${size['size-2']}`,
    },
  },
})

export const sidebar_item_group = style({
  '@layer': {
    [app]: {
      marginTop: size['size-2'],
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      margin: `${size['size-4']} 0`,
      padding: `0 ${size['size-2']}`,
    },
  },
})

export const sidebar_item = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'start',
      alignItems: 'center',
      color: theme.vars.typography.color.main,
      textDecoration: 'none',
      height: theme.component.appShell.sidebar.spacing.height.item,
      marginBottom: '.5rem',
    },
  },
})

export const sidebar_item_title = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: '1rem',
      height: theme.component.appShell.sidebar.spacing.height.item,
      width: '100%',
    },
  },
})

export const sidebar_icon = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      color: theme.vars.typography.color.main,
      height: '100%',
      width: theme.component.appShell.sidebar.spacing.height.item,
    },
  },
})

export const sidebar_footer = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    },
  },
})
