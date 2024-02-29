import { style, styleVariants, createVar } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

export const thumb_height = createVar()

export const thumb_top = createVar()

export const scroll_area_base = style({
  '@layer': {
    [app]: {
      height: '100%',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      position: 'relative',

      selectors: {
        '&::webkit-scrollbar': {
          display: 'none',
        },
      },
    },
  },
})

export const scroll_area = styleVariants({
  horizontal: [
    scroll_area_base,
    {
      '@layer': {
        [app]: {
          overflowX: 'auto',
        },
      },
    },
  ],
  vertical: [
    scroll_area_base,
    {
      '@layer': {
        [app]: {
          overflowY: 'auto',
          zIndex: 0,
        },
      },
    },
  ],
  all: [
    scroll_area_base,
    {
      '@layer': {
        [app]: {
          overflow: 'auto',
        },
      },
    },
  ],
})

export const scroll_area_wrapper = style({
  '@layer': {
    [app]: {
      position: 'relative',
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
  },
})

export const scroll_bar_vertical = style({
  '@layer': {
    [app]: {
      width: '.75rem',
      height: '100%',
      right: 0,
      top: 0,
      position: 'absolute',
      borderRadius: '.5rem',
      backgroundColor: 'rgba(0, 0, 0, .35)',
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

export const scroll_thumb = style({
  '@layer': {
    [app]: {
      width: '.75rem',
      position: 'absolute',
      borderRadius: '.5rem',
      opacity: '1',
      backgroundColor: 'rgba(0,0,0,.55)',
      zIndex: 11,
    },
  },
})
