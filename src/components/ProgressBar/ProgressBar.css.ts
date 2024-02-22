import { style, createVar } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import palette from '../../css/colors.css'
import { theme } from '../../css/global.css'

export const progress_width = createVar()

export const progress_bar = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      counterReset: 'step',
      padding: '2.5rem 2rem 2rem',
      width: 'auto',
      borderBottom: theme.vars['app-border-line-style'],
    },
  },
})

export const progress_empty = style({
  '@layer': {
    [app]: {
      content: '',
      position: 'absolute',
      left: '3rem',
      height: '1rem',
      backgroundColor: palette['gray-3'],
      zIndex: 2,
      width: progress_width,
      transition: 'width .3s ease-in-out',
    },
  },
})

export const progress_fill = style({
  '@layer': {
    [app]: {
      content: '',
      position: 'relative',
      left: '1rem',
      height: '1rem',
      backgroundColor: palette['blue-7'],
      zIndex: 2,
      width: progress_width,
      transition: 'width .3s ease-in-out',
    },
  },
})

export const progress_step_wrapper = style({
  '@layer': {
    [app]: {
      padding: '0 2rem',
      position: 'absolute',
      left: '0',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
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
      transition: 'background-color .3s ease-in-out',

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
          border: 'none',
        },
      },
    },
  },
})
