import { style } from '@vanilla-extract/css'
import { theme } from '../../css/theme.css'
import { space } from '../../css/size.css'

export const auth_container = style({
  '@layer': {
    ['app']: {
      'padding': `0 35%`,
      'display': 'flex',
      'flexDirection': 'column',
      'height': '100%',
      'justifyContent': 'center',

      '@media': {
        '(max-width: 1024px)': {
          'padding': `0 20%`,
        },
        '(max-width: 567px)': {
          'padding': `0 5%`,
        },
      },
    },
  },
})

export const auth_link = style({
  '@layer': {
    ['app']: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: space['space-4'],
      textDecoration: 'none',
      cursor: 'pointer',
      color: theme.vars.typography.color.main,
    },
  },
})

export const error_message = style({
  '@layer': {
    ['app']: {
      display: 'flex',
      backgroundColor: theme.vars.typography.backgroundColor.error,
      padding: space['space-2'],
      marginBottom: space['space-2'],
      alignItems: 'center',
      columnGap: space['space-1'],
    },
  },
})
