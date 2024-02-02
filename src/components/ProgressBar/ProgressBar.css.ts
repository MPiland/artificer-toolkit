import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import palette from '../../css/colors.css'
import { theme } from '../../css/global.css'

export const progress_bar = style({
  '@layer': {
    [app]: {
      'position': 'relative',
      'display': 'flex',
      'justifyContent': 'space-between',
      'counterReset': 'step',
      'margin': '2rem 4rem 1rem',
      'alignItems': 'center',

      '@media': {
        'screen and (min-width: 568px) and (max-width: 1024px)': {
          margin: '2rem 3rem  1rem',
        },
        'screen and (max-width: 567px)': {
          margin: '2rem 2rem  1rem',
        },
      },

      'selectors': {
        '&:before': {
          content: '',
          position: 'absolute',
          top: 0,
          left: 0,
          height: '2rem',
          borderRadius: '1rem',
          width: '100%',
          backgroundColor: palette['gray-5'],
          zIndex: 1,
        },
      },
    },
  },
})

export const progress = style({
  '@layer': {
    [app]: {
      content: '',
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      height: '2rem',
      borderRadius: '1rem',
      width: '0',
      backgroundColor: palette['gray-5'],
      zIndex: 2,
    },
  },
})

export const progress_step = style({
  '@layer': {
    [app]: {
      width: '2rem',
      height: '2rem',
      backgroundColor: palette['gray-5'],
      borderRadius: '50%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
      color: 'white',
      fontWeight: 'bold',

      selectors: {
        '&:before': {
          counterIncrement: 'step',
          content: 'counter(step)',
        },
        '&:after': {
          content: 'attr(data-atapp-step)',
          position: 'absolute',
          bottom: 'calc(100% + 0.125rem)',
          color: theme.vars['app-color'],
        },
        '&.active': {
          backgroundColor: palette['blue-7'],
          border: 'none',
        },
        '&.active:before': {
          backgroundColor: palette['blue-7'],
          border: 'none',
        },
      },
    },
  },
})
