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
      minHeight: '0',
      flex: '1 1 auto',

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

export const scroll_arrow = style({
  '@layer': {
    [app]: {
      width: '1.25rem',
      backgroundColor: theme.vars.typography.color.main,
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
