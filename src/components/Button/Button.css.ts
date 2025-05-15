import { createVar, globalStyle, style, styleVariants } from '@vanilla-extract/css'
import { app } from '@/css/layers.css'
import { space, size } from '@/css/size.css'

export const button_background_color = createVar('button-background-color')
export const button_filled_hover = createVar('button-filled-hover')
export const button_outline_hover = createVar('button-outline-hover')

export const button = style({
  '@layer': {
    [app]: {
      position: 'relative',
      cursor: 'pointer',
      outline: 'none',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 0,
      padding: `${space['space-2']} ${space['space-4']}`,
      flexWrap: 'nowrap',
      overflow: 'hidden',
    },
  },
})

export const button_style = styleVariants({
  unstyled: {
    '@layer': {
      [app]: {
        padding: 0,
        backgroundColor: 'transparent',
        border: 'none',

        selectors: {
          '&:disabled': {
            cursor: 'not-allowed',
            opacity: 0.6,
          },
        },
      },
    },
  },
  filled: {
    '@layer': {
      [app]: {
        color: 'white',
        border: 'none',
        backgroundColor: button_background_color,

        selectors: {
          '&:not(:disabled):hover': {
            backgroundColor: button_filled_hover,
          },
          '&:not(:disabled):active': {
            backgroundImage: 'linear-gradient(rgb(0 0 0/40%) 0 0)',
          },
          '&:disabled': {
            cursor: 'not-allowed',
            opacity: 0.6,
          },
        },
      },
    },
  },
  outline: {
    '@layer': {
      [app]: {
        backgroundColor: 'transparent',

        selectors: {
          '&:not(:disabled):hover': {
            backgroundColor: button_outline_hover,
          },
          '&:disabled': {
            cursor: 'not-allowed',
            opacity: 0.6,
          },
        },
      },
    },
  },
})

export const button_width = styleVariants(size, (sizeValue) => [button, { '@layer': { [app]: { width: sizeValue } } }])

export const button_content = style({
  '@layer': {
    [app]: {
      position: 'relative',
      height: '100%',
      alignItems: 'center',
      userSelect: 'none',
      zIndex: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'row',

      selectors: {
        [`${button}${button_width['size-full']} > &`]: {
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          display: 'unset',
          alignContent: 'center',
          flex: 1,
        },
      },
    },
  },
})

globalStyle(`${button} svg`, {
  '@layer': {
    [app]: {
      height: '100%',
      width: 'auto',
    },
  },
})
