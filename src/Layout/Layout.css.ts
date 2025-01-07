import { style } from '@vanilla-extract/css'
import { app } from '../css/layers.css'
import { fontSize } from '../css/typography.css'
import { theme } from '../css/theme.css'
import { space } from '../css/size.css'

export const header_title = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      columnGap: space['space-2'],
      margin: 'auto 0',
      fontSize: '22px',
      fontWeight: '600',
      order: 2,
      cursor: 'pointer',
      textWrap: 'nowrap',
      color: theme.vars.typography.color.main,
    },
  },
})

export const header_item_group = style({
  '@layer': {
    [app]: {
      'marginLeft': 'auto',
      'listStyleType': 'none',
      'display': 'flex',
      'flexDirection': 'row',
      'justifyContent': 'space-between',
      'alignItems': 'center',
      'order': 3,
      'paddingRight': space['space-4'],
      'height': '100%',
      'width': '100%',

      '@media': {
        '(min-width: 1024px)': {
          justifyContent: 'end',
        },
      },

      'selectors': {
        '&:first-child': {
          paddingLeft: 0,
        },
        '&:last-child': {
          paddingRight: 0,
        },
      },
    },
  },
})

export const header_item = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      height: '100%',
      textAlign: 'start',
      fontSize: fontSize['font-size-1'],
      textDecoration: 'none',
      color: theme.vars.typography.color.main,
      margin: 'auto 0',
      padding: `0 ${space['space-1']}`,
      cursor: 'pointer',
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
    },
  },
})

export const sidebar_item_group = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
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
