import { style } from '@vanilla-extract/css'
import { fontSize } from '../../../css/typography.css'
import { app } from '../../../css/layers.css'
import { size } from '../../../css/size.css'

export const progress_tab = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'position': 'relative',
      'counterReset': 'step',
      'paddingTop': '1rem',
      'overflow': 'hidden',
      'height': 'fit-content',

      '@media': {
        'screen and (max-width: 567px)': {
          margin: `0 ${size['size-3']}`,
        },
      },
    },
  },
})

export const progress_step_container = style({
  '@layer': {
    [app]: {
      width: '100%',
      display: 'flex',
      margin: '0 auto',
      justifyContent: 'space-between',
    },
  },
})

export const progress_step = style({
  '@layer': {
    [app]: {
      width: 'auto',
      height: 'auto',
      padding: '1rem 0.5rem 1rem',
      backgroundColor: 'transparent',
      fontSize: fontSize['font-size-0'],
      cursor: 'pointer',
      position: 'relative',
    },
  },
})

export const progress_line = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      bottom: '0',
      left: '0',
      height: '0.25rem',
      transition: 'width .3s ease-in-out',
    },
  },
})
