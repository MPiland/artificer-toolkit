import { createVar, globalStyle, style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const height = createVar()

export const accordion = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      height: 'auto',
    },
  },
})

export const accordion_wrapper = style({
  '@layer': {
    [app]: {
      position: 'relative',
      boxShadow: '-2px 2px 4px 0px rgba(0,0,0,0.2)',
      zIndex: 2,
      marginBottom: size['size-3'],

      selectors: {
        '&.borderless': {
          border: 'none',
          borderRadius: '0',
        },
      },
    },
  },
})

export const accordion_header = style({
  width: '100%',
  fontWeight: 'bold',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  padding: `${size['size-2']} ${size['size-3']}`,
  height: '2.5rem',
  flexWrap: 'nowrap',
  borderBottomLeftRadius: '0',
  borderBottomRightRadius: '0',

  selectors: {
    [`${accordion_wrapper}.collapsed &`]: {
      border: 'none',
    },
  },
})

export const accordion_header_icon = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: 'auto',
      alignItems: 'center',
      display: 'flex',
      marginLeft: size['size-3'],
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
      marginRight: size['size-1'],
    },
  },
})

export const accordion_content_wrapper = style({
  '@layer': {
    [app]: {
      display: 'grid',
      borderSpacing: 0,
      gridTemplateRows: '1fr',
      transition: 'grid-template-rows 0.3s ease-in-out',

      selectors: {
        [`${accordion_wrapper}.collapsed &`]: {
          gridTemplateRows: '0fr',
        },
      },
    },
  },
})

export const accordion_content = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: 'auto',
      overflow: 'hidden',
      padding: `${size['size-3']} ${size['size-3']}`,
      transition: 'padding 0.3s ease-in-out',

      selectors: {
        [`${accordion_wrapper}.collapsed &`]: {
          padding: `0 ${size['size-3']}`,
        },
      },
    },
  },
})

export const accordion_footer = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      padding: `${size['size-1']} ${size['size-2']}`,
    },
  },
})

globalStyle(`${accordion_header_icon} svg`, {
  '@layer': {
    [app]: {
      height: '60%',
      width: 'auto',
    },
  },
})
