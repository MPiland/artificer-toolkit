import { style, styleVariants, createVar, globalStyle } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { theme } from '../../css/theme.css'
import { size } from '../../css/size.css'

export const thumb_height = createVar()

export const thumb_top = createVar()

export const scroll_area_wrapper = style({
  '@layer': {
    [app]: {
      position: 'relative',
      flex: 1,
      width: '100%',
      padding: `0 ${size['size-3']}`,

      selectors: {
        '&.overflow_hidden': {
          overflow: 'hidden',
        },
      },
    },
  },
})

export const scroll_area_base = style({
  '@layer': {
    [app]: {
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      position: 'relative',
      height: '100%',
      width: 'inherit',
      zIndex: 0,
      overflow: 'hidden',

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
  none: [
    scroll_area_base,
    {
      '@layer': {
        [app]: {
          overflow: 'hidden',
        },
      },
    },
  ],
})

export const scroll_bar_vertical = style({
  '@layer': {
    [app]: {
      width: '.5rem',
      height: '100%',
      right: 0,
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
      backgroundColor: 'rgba(0,0,0,.55)',
      zIndex: 11,
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

export const scroll_arrow = style({
  '@layer': {
    [app]: {
      width: '1.25rem',
      backgroundColor: theme.vars.color,
      height: '100%',
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      zIndex: 2,

      selectors: {
        '&.left': {
          top: 0,
          left: 0,
        },
        '&.right': {
          top: 0,
          right: 0,
        },
      },
    },
  },
})

globalStyle(`${scroll_arrow} > svg`, {
  '@layer': {
    [app]: {
      width: '100%',
      height: 'auto',
    },
  },
})
