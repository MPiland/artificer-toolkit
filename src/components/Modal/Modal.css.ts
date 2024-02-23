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
      width: '100vw',
      height: '100vh',
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
          width: '75lvw',
          maxHeight: '60lvh',
        },
        '&.lg': {
          width: '90lvw',
          height: 'fit-content',
          maxHeight: '80lvh',
        },
        '&.fullscreen': {
          width: '100lvw',
          height: '100lvh',
        },
      },
      '@media': {
        'screen and (max-width: 567px)': {
          borderRadius: '0',
          width: '100lvw',
          height: '100lvh',
          maxHeight: '100lvh',
        },
      },
    },
  },
})

export const modal_content = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'flexDirection': 'column',
      'width': '100%',
      'overflow': 'hidden',
      'zIndex': '10',
      'padding': size['size-7'],
      'color': theme.vars['app-color'],
      'justifyContent': 'center',

      '@media': {
        'screen and (max-width: 567px)': {
          padding: size['size-9'],
        },
        'screen and (min-width: 568px) and (max-width: 768px)': {
          padding: '2rem',
        },
      },

      'selectors': {
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
      height: 'fit-content',
      paddingBottom: size['size-3'],
    },
  },
})

export const modal_body = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      padding: `${size['size-3']} 0`,
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
      display: 'flex',
      flexDirection: 'column',
      paddingTop: size['size-3'],
      textAlign: 'center',
    },
  },
})
