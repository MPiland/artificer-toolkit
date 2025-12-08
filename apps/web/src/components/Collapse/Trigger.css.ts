import { globalStyle, style } from '@vanilla-extract/css'
import { size } from '~css/size.css'
import { app } from '~css/layers.css'

export const base = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${size['size-3']} 0`,
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      backgroundColor: 'transparent',

      selectors: {
        '&:focus-visible': {
          outline: 'none',
        },
      },
    },
  },
})

export const title = style({
  '@layer': {
    [app]: {
      textWrap: 'nowrap',
      margin: `0 ${size['size-2']}`,
    },
  },
})

export const icon = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      opacity: 0.6,
      height: size['size-4'],
      width: size['size-4'],
    },
  },
})

export const icon_collapse = style({
  '@layer': {
    [app]: {
      transitionProperty: 'transform, translate, scale, rotate',
      transitionTimingFunction: 'cubic-bezier(0.7,0,0.3,1)',
      transitionDuration: '.3s',
      transformOrigin: '50%',

      selectors: {
        [`${base}[data-state="open"] > &`]: {
          rotate: '180deg',
        },
      },
    },
  },
})

globalStyle(`${base}[data-state="open"] > ${icon_collapse} > path:last-child`, {
  '@layer': {
    [app]: {
      opacity: '0',
      rotate: '90deg',
    },
  },
})
