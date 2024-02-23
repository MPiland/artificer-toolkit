import { theme } from '../../css/global.css'
import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const modal = style({
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
      backgroundColor: 'rgba(0, 0, 0, 0.541)',
      zIndex: 2,
    },
  },
})

export const modal_dialogue = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'flexDirection': 'row',
      'backgroundColor': theme.vars['app-background-color'],
      'width': '400px',
      'zIndex': 5,
      'borderRadius': '0.5rem',
      'overflow': 'hidden',
      'selectors': {
        '&.md': {
          width: '75dvw',
          maxHeight: '60dvh',
        },
        '&.lg': {
          width: '90dvw',
          height: 'fit-content',
          maxHeight: '80dvh',
        },
        '&.fullscreen': {
          width: '100dvw',
          height: '100dvh',
        },
      },
      '@media': {
        'screen and (max-width: 567px)': {
          borderRadius: '0',
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
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      overflow: 'hidden',
      zIndex: '10',
      padding: `${size['size-7']} 0`,
      color: theme.vars['app-color'],
      justifyContent: 'center',

      selectors: {
        '&.scrollable': {
          overflowY: 'auto',
        },
      },
    },
  },
})

export const modal_header = style({
  '@layer': {
    [app]: {
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
      'display': 'flex',
      'flexDirection': 'column',
      'position': 'relative',
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
      fontSize: '2rem',
      fontWeight: 'bold',
      margin: 0,
    },
  },
})

export const modal_footer = style({
  '@layer': {
    [app]: {
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
      margin: `0 ${size['size-7']}`,
    },
  },
})
