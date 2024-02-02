import { keyframes, style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
})

export const spinner_container = style({
  '@layer': {
    [app]: {
      vars: {
        '--spinner-size': '3rem',
        '--spinner-thickness': '6px',
      },
      margin: 'auto auto',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignContent: 'center',
      selectors: {
        '&.small': {
          vars: {
            '--spinner-size': '2rem',
            '--spinner-thickness': '4px',
          },
        },
      },
    },
  },
})

export const spinner = style({
  '@layer': {
    [app]: {
      border: 'var(--spinner-thickness) solid #3498db',
      borderTop: 'var(--spinner-thickness) solid #f3f3f3',
      borderRadius: '50%',
      width: 'var(--spinner-size)',
      height: 'var(--spinner-size)',
      animation: `${spin} 1s linear infinite`,
    },
  },
})
