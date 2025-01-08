import { style } from '@vanilla-extract/css'
import { app } from '../css/layers.css'
import { theme } from '../css/theme.css'
import { space } from '../css/size.css'
import { fontSize } from '../css/typography.css'

export const header = style({
  '@layer': {
    [app]: {
      gridArea: 'header',
      display: 'flex',
      alignItems: 'center',
      backgroundColor: theme.vars.component.content.backgroundColor.main,
      borderBottom: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
      padding: theme.component.appShell.header.spacing.padding,
      height: theme.component.appShell.header.spacing.height,
    },
  },
})

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
