import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { fontSize } from '../../css/typography.css'
import { theme } from '../../css/global.css'

export const header_title = style({
  '@layer': {
    [app]: {
      margin: 'auto 0',
      fontSize: 'larger',
      fontWeight: '600',
      order: 2,
      cursor: 'pointer',
    },
  },
})

export const header_item_group = style({
  '@layer': {
    [app]: {
      margin: 'auto 0',
      marginLeft: 'auto',
      listStyleType: 'none',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      order: 3,
      padding: '0',
    },
  },
})

export const header_item = style({
  '@layer': {
    [app]: {
      margin: '0 .5rem',
      display: 'flex',
      flexDirection: 'column',
      textAlign: 'start',
      padding: '.5rem .5rem',
      cursor: 'pointer',
      fontSize: fontSize['font-size-1'],

      selectors: {
        '&:hover': {
          backgroundColor: 'rgb(200, 200, 200)',
        },
      },
    },
  },
})

export const header_nav_item = style({
  '@layer': {
    [app]: {
      textDecoration: 'none',
      fontSize: 'inherit',
      
      selectors: {
        '&:visited': {
          color: theme.vars['app-color'],
        },
      },
    },
  },
})

export const sidebar_item_group = style({
  '@layer': {
    [app]: {
      listStyleType: 'none',
      padding: '0',
    },
  },
})
