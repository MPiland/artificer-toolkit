import { style } from '@vanilla-extract/css'
import { app } from '@/css/layers.css'
import { size } from '@/css/size.css'

export const modal = style({
  '@layer': {
    [app]: {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 300,
    },
  },
})

export const modal_background = style({
  '@layer': {
    [app]: {
      position: 'fixed',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      top: 0,
      left: 0,
      width: '100dvw',
      height: '100dvh',
      zIndex: 200,
    },
  },
})

export const modal_dialogue = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      width: '400px',
      zIndex: 500,
      borderRadius: '0.5rem',
      overflow: 'hidden',
      justifyContent: 'center',

      selectors: {
        '&.xs': {
          'width': '20dvw',
          'minWidth': '20rem',
          'maxHeight': '80dvh',

          '@media': {
            'screen and (max-width: 567px)': {
              borderRadius: '0',
              width: '100dvw',
              height: '100dvh',
              maxHeight: '100dvh',
            },
          },
        },
        '&.sm': {
          'width': '30dvw',
          'maxHeight': '80dvh',

          '@media': {
            'screen and (max-width: 567px)': {
              borderRadius: '0',
              width: '100dvw',
              height: '100dvh',
              maxHeight: '100dvh',
            },
          },
        },
        '&.md': {
          'width': '60dvw',
          'maxHeight': '80dvh',

          '@media': {
            'screen and (max-width: 567px)': {
              borderRadius: '0',
              width: '100dvw',
              height: '100dvh',
              maxHeight: '100dvh',
            },
          },
        },
        '&.lg': {
          'width': '90dvw',
          'height': 'fit-content',
          'maxHeight': '80dvh',

          '@media': {
            'screen and (max-width: 567px)': {
              borderRadius: '0',
              width: '100dvw',
              height: '100dvh',
              maxHeight: '100dvh',
            },
          },
        },
        '&.fullscreen': {
          width: '100dvw',
          height: '100dvh',
        },
      },
    },
  },
})

export const modal_content = style({
  '@layer': {
    [app]: {
      'position': 'relative',
      'display': 'flex',
      'flexDirection': 'column',
      'width': '100%',
      'overflow': 'hidden',
      'zIndex': '10',
      'padding': `${size['size-7']} 0`,
      'justifyContent': 'center',

      'selectors': {
        '&.scrollable': {
          overflowY: 'auto',
        },
      },
      '@media': {
        'screen and (max-width: 567px)': {
          justifyContent: 'start',
        },
      },
    },
  },
})

export const modal_header = style({
  '@layer': {
    [app]: {
      'position': 'relative',
      'height': 'fit-content',
      'padding': `0 ${size['size-9']} ${size['size-3']}`,

      '@media': {
        'screen and (max-width: 567px)': {
          padding: `0 ${size['size-7']} ${size['size-3']}`,
        },
      },
    },
  },
})

export const modal_body = style({
  '@layer': {
    [app]: {
      'position': 'relative',
      'display': 'flex',
      'overflow': 'hidden',
      'padding': `${size['size-3']} ${size['size-9']}`,

      '@media': {
        'screen and (max-width: 567px)': {
          padding: `${size['size-3']} ${size['size-7']}`,
        },
      },
    },
  },
})

export const modal_title = style({
  '@layer': {
    [app]: {
      fontWeight: 'bold',
      margin: 0,
    },
  },
})

export const modal_footer = style({
  '@layer': {
    [app]: {
      'position': 'relative',
      'display': 'flex',
      'flexDirection': 'column',
      'padding': ` ${size['size-3']} ${size['size-9']} 0`,
      'textAlign': 'center',

      '@media': {
        'screen and (max-width: 567px)': {
          padding: ` ${size['size-3']} ${size['size-7']} 0`,
        },
      },
    },
  },
})

export const modal_divider = style({
  '@layer': {
    [app]: {
      position: 'relative',
      margin: `0 ${size['size-7']}`,
    },
  },
})
