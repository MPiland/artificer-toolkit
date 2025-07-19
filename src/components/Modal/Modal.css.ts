import { style } from '@vanilla-extract/css'
import { app } from '@/css/layers.css'
import { size } from '@/css/size.css'
import { vars } from '@/css/theme'

export const base = style({
  '@layer': {
    [app]: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100dvw',
      height: '100dvh',
      zIndex: 500,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: vars.colors.gray[5],

      selectors: {
        [vars.darkSelector]: {
          backgroundColor: vars.colors.dark[5],
        },
      },
    },
  },
})

export const background = style({
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
      zIndex: 400,
      pointerEvents: 'none',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
  },
})

export const dialogue = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '400px',
      zIndex: 500,
      borderRadius: '0.5rem',
      overflow: 'hidden',
      justifyContent: 'center',
      height: 'fit-content',
      outline: 'none',

      selectors: {
        '&.xs': {
          'maxWidth': '20dvw',
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
          'maxWidth': '30dvw',
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
          'maxWidth': '60dvw',
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
          'maxWidth': '90dvw',
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

export const content = style({
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
      'height': 'fit-content',
      'outline': 'none',

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

export const header = style({
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

export const body = style({
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

export const title = style({
  '@layer': {
    [app]: {
      fontWeight: 'bold',
      margin: 0,
    },
  },
})

export const footer = style({
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

export const divider = style({
  '@layer': {
    [app]: {
      position: 'relative',
      margin: `0 ${size['size-7']}`,
    },
  },
})
