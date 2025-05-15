import { globalStyle, style } from '@vanilla-extract/css'
import { app } from '@/css/layers.css'
import { size, space } from '@/css/size.css'
import { vars } from 'src/css/theme'

export const accordion_item = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      zIndex: 2,
      backgroundColor: vars.colors.gray[8],
      marginTop: '-1px',
      transition: 'background-color 0.3s ease',
    },
  },
})

export const accordion_header = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${space['space-3']} ${space['space-4']}`,
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      border: 'none',
      transition: 'all 0.3s ease',

      selectors: {
        '&:focus-visible': {
          outline: 'none',
        },
      },
    },
  },
})

export const accordion_header_icon_collapse = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      right: space['space-4'],
      transitionProperty: 'transform, translate, scale, rotate',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      transitionDuration: '.2s',
      transformOrigin: '50%',

      selectors: {
        [`${accordion_header}[aria-expanded="true"] > &`]: {
          rotate: '180deg',
        },
      },
    },
  },
})

export const accordion_header_icon = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      opacity: 0.6,
      height: size['size-4'],
      width: size['size-4'],
    },
  },
})

export const accordion_remove_button = style({
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

export const accordion_content = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: 'auto',
      overflow: 'hidden',
      padding: `${space['space-3']} ${space['space-3']}`,
      transition: 'padding 0.3s ease-in-out',
    },
  },
})

export const accordion_footer = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      padding: `${space['space-1']} ${space['space-2']}`,
    },
  },
})

globalStyle(`${accordion_header}[aria-expanded="true"] > ${accordion_header_icon_collapse} > svg > path:last-child`, {
  '@layer': {
    [app]: {
      opacity: '0',
      rotate: '90deg',
    },
  },
})

globalStyle(`${accordion_header_icon_collapse} > svg > path:last-child`, {
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
