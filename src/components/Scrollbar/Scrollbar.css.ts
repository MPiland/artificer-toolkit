import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { lightColors } from '../../css/colors.css'

export const scroll_bar_vertical = style({
  '@layer': {
    [app]: {
      width: '.5rem',
      height: '100%',
      right: '1rem',
      top: 0,
      position: 'absolute',
      borderRadius: '.5rem',
      backgroundColor: 'transparent',
      opacity: 0,
      transition: 'opacity .2s ease-in-out',
      zIndex: 10,

      selectors: {
        '&.active': {
          opacity: 1,
        },
      },
    },
  },
})

export const scroll_thumb_vertical = style({
  '@layer': {
    [app]: {
      width: '.5rem',
      position: 'absolute',
      borderRadius: '.5rem',
      opacity: '1',
      backgroundColor: lightColors['slate9'],
      zIndex: 11,
      height: '1rem',
    },
  },
})

export const scroll_bar_horizontal = style({
  '@layer': {
    [app]: {
      height: '.5rem',
      width: '100%',
      left: 0,
      bottom: '.25rem',
      position: 'absolute',
      borderRadius: '.5rem',
      backgroundColor: 'transparent',
      opacity: 0,
      transition: 'opacity .2s ease-in-out',
      zIndex: 10,

      selectors: {
        '&.active': {
          opacity: 1,
        },
      },
    },
  },
})

export const scroll_thumb_horizontal = style({
  '@layer': {
    [app]: {
      height: '.5rem',
      position: 'absolute',
      borderRadius: '.5rem',
      opacity: '1',
      backgroundColor: 'rgba(0,0,0,.55)',
      zIndex: 11,
    },
  },
})
