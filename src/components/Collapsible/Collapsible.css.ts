import { globalStyle, style } from '@vanilla-extract/css'
import { theme } from 'src/css/theme'
import { size, space } from '../../css/size.css'
import { app } from '@/css/layers.css'
import { fontSize } from '@/css/typography.css'

export const card = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      border: `${theme.other?.border.width.thin} ${theme.other?.border.style} ${theme.other?.border.color}`,
      borderRadius: theme.defaultRadius,
      marginBottom: space['space-4'],
      outline: 'none',
    },
  },
})

export const card_trigger = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${size['size-3']} ${size['size-4']}`,
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

export const card_trigger_title = style({
  '@layer': {
    [app]: {
      textWrap: 'nowrap',
    },
  },
})

export const card_trigger_icon = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      opacity: 0.6,
      height: size['size-4'],
      width: size['size-4'],
    },
  },
})

export const card_trigger_icon_collapse = style({
  '@layer': {
    [app]: {
      transitionProperty: 'transform, translate, scale, rotate',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      transitionDuration: '.2s',
      transformOrigin: '50%',

      selectors: {
        [`${card_trigger}[data-state="open"] > &`]: {
          rotate: '180deg',
        },
      },
    },
  },
})

export const card_content_wrapper = style({
  overflow: 'hidden',
})

export const card_content = style({
  '@layer': {
    [app]: {
      width: '100%',
      overflow: 'hidden',
      padding: `${size['size-3']} ${size['size-4']}`,
    },
  },
})

export const card_footer = style({
  '@layer': {
    [app]: {
      padding: `${size['size-3']} ${size['size-4']}`,
      border: `${theme.other?.border.width.thin} ${theme.other?.border.style} ${theme.other?.border.color}`,
    },
  },
})

globalStyle(`${card_footer} *`, {
  '@layer': {
    [app]: {
      fontSize: fontSize['font-size-00'],
    },
  },
})

globalStyle(`${card_content} p:last-of-type`, {
  '@layer': {
    [app]: {
      marginBottom: 0,
    },
  },
})

globalStyle(`${card_content} p:first-of-type`, {
  '@layer': {
    [app]: {
      marginTop: 0,
    },
  },
})

globalStyle(`${card_trigger}[data-state="open"] > ${card_trigger_icon_collapse} > path:last-child`, {
  '@layer': {
    [app]: {
      opacity: '0',
      rotate: '90deg',
    },
  },
})

globalStyle(`${card_trigger_icon_collapse} > path:last-child`, {
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
