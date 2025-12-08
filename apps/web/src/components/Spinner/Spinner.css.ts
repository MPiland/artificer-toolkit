import { style } from '@vanilla-extract/css'
import { app } from '~css/layers.css'

export const spinner_container = style({
  '@layer': {
    [app]: {
      margin: 'auto auto',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignContent: 'center',
    },
  },
})

export const spinner = style({
  '@layer': {
    [app]: {
      'vars': {
        '--loader-size': '3rem',
      },
      '@container': {
        '(width <= 3rem)': {
          vars: {
            '--loader-size': '2rem',
          },
        },
      },
    },
  },
})
