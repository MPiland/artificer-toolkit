import { theme } from '../../css/global.css'
import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const app_shell = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      width: '100%',
      overflow: 'hidden',
      backgroundColor: theme.vars['app-background-color'],
      color: theme.vars['app-color'],
    },
  },
})

export const app_main = style({
  '@layer': {
    [app]: {
      'position': 'relative',
      'padding': '0 calc(((100% - 80%) / 2))',
      'overflow': 'hidden',
      'backgroundColor': 'inherit',
      'height': `calc(100dvh - ${theme['header-height']})`,
      'display': 'flex',
      'flexDirection': 'column',

      '@media': {
        'screen and (min-width: 568px) and (max-width: 1024px)': {
          padding: '0 calc(((100% - 90%) / 2))',
        },
        'screen and (max-width: 567px)': {
          padding: '0',
        },
      },

      'selectors': {
        '&.sidebar_active::after': {
          content: '',
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(128, 128, 128, 0.5)',
          zIndex: '10',
        },

        '&.sidebar_active': {
          pointerEvents: 'none',
        },
      },
    },
  },
})

export const app_header = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      top: '0',
      left: '0',
      width: '100%',
      height: theme['header-height'],
      display: 'flex',
      flexDirection: 'row',
      border: 'none',
      borderBottom: theme.vars['app-border-line-style'],
      paddingLeft: size['size-5'],
    },
  },
})

export const hamburger_wrapper = style({
  '@layer': {
    [app]: {
      margin: 'auto 1rem auto 0',
      display: 'flex',
      cursor: 'pointer',
      width: `${theme['hamburger-wrapper-width']}`,
      height: `calc(${theme['hamburger-wrapper-width']} + 0.5rem)`,
      alignItems: 'center',
      justifyContent: 'center',
      order: 1,
    },
  },
})

export const hamburger = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      cursor: 'pointer',
      width: theme['hamburger-wrapper-width'],
      height: theme['hamburger-wrapper-width'],
    },
  },
})

export const hamburger_line = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: theme['hamburger-line-height'],
      backgroundColor: '#333',
      transition: 'transform .3s, opacity .3s',
      transformOrigin: 'center',
      vars: {
        '--hamburger-line-margin': `calc((${theme['hamburger-wrapper-width']} - (${theme['hamburger-line-height']} * 3)) / 2)`,
        '--hamburger-translateY': `calc(var(--hamburger-line-margin) + ${theme['hamburger-line-height']})`,
      },
      selectors: {
        '.active &:nth-of-type(1)': {
          transform: `translateY(var(--hamburger-translateY)) rotate(45deg)`,
        },
        '.active &:nth-of-type(2)': {
          opacity: '0',
        },
        '.active &:nth-of-type(3)': {
          transform: `translateY(calc(-1 * var(--hamburger-translateY)))
      rotate(-45deg)`,
        },
      },
    },
  },
})

export const app_sidebar = style({
  '@layer': {
    [app]: {
      'position': 'absolute',
      'top': `${theme['header-height']}`,
      'bottom': 0,
      'left': 'calc(-1 * 25%)',
      'width': '25%',
      'zIndex': 3000,
      'border': 'none',
      'backgroundColor': 'inherit',
      'transition': 'all .3s ease-in-out',

      '@media': {
        'screen and (max-width: 567px)': {
          width: '50%',
          left: 'calc(-1 * 50%)',
        },
        'screen and (min-width: 568px) and (max-width: 1023px)': {
          width: '35%',
          left: 'calc(-1 * 35%)',
        },
      },

      'selectors': {
        '&.active': {
          left: '0',
          borderRight: theme.vars['app-border-line-style'],
        },
      },
    },
  },
})
