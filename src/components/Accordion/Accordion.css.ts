import { globalStyle, style } from '@vanilla-extract/css'
import { app } from '~/css/layers.css'
import { size, space } from '~/css/size.css'

export const item = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      zIndex: 2,
      backgroundColor: 'transparent',
    },
  },
})

export const header = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      border: 'none',
      transition: 'all 0.3s ease',

      selectors: {
        '&:focus-visible': {
          outline: 'none',
        },
        [`${item}:where([data-active]) &`]: {
          backgroundColor: 'var(--item-filled-color)',
        },
      },
    },
  },
})

export const header_icon_collapse = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      right: space['space-4'],
      transitionProperty: 'transform, translate, scale, rotate',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      transitionDuration: '.2s',
      transformOrigin: '50%',

      selectors: {
        [`${header}[aria-expanded="true"] > &`]: {
          rotate: '180deg',
        },
      },
    },
  },
})

export const header_icon = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      opacity: 0.6,
      height: size['size-4'],
      width: size['size-4'],
    },
  },
})

export const remove_button = style({
  '@layer': {
    [app]: {
      width: '1.5rem',
      height: '1.5rem',
      borderRadius: '.5rem',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: space['space-1'],
    },
  },
})

export const content = style({
  '@layer': {
    [app]: {
      backgroundColor: 'transparent',
    },
  },
})

export const footer = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      padding: `${space['space-1']} ${space['space-2']}`,
    },
  },
})

globalStyle(`${header}[aria-expanded="true"] > ${header_icon_collapse} > svg > path:last-child`, {
  '@layer': {
    [app]: {
      opacity: '0',
      rotate: '90deg',
    },
  },
})

globalStyle(`${header_icon_collapse} > svg > path:last-child`, {
  '@layer': {
    [app]: {
      flexShrink: 0,
      transitionProperty: 'all',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      transitionDuration: '.2s',
      pointerEvents: 'none',
      transformOrigin: '50%',
    },
  },
})
