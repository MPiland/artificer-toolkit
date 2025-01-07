import { theme } from '../../css/theme.css'
import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const app_shell = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'flexDirection': 'row',
      'height': '100dvh',
      'width': '100%',
      'overflow': 'hidden',
      'color': theme.vars.typography.color.main,

      '@media': {
        '(max-width: 1024px)': {
          flexDirection: 'column',
        },
      },
    },
  },
})

export const app_header = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      top: 0,
      right: 0,
      width: '100%',
      height: theme.component.appShell.header.spacing.height,
      display: 'flex',
      flexDirection: 'row',
      borderBottom: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
      padding: theme.component.appShell.header.spacing.padding,
      backgroundColor: theme.vars.component.content.backgroundColor.main,
    },
  },
})

export const app_sidebar = style({
  '@layer': {
    [app]: {
      'boxSizing': 'content-box',
      'position': 'relative',
      'left': 0,
      'top': 0,
      'display': 'flex',
      'flexDirection': 'column',
      'justifyContent': 'space-between',
      'width': theme.component.appShell.sidebar.spacing.width.main,
      'backgroundColor': theme.vars.component.appShell.sidebar.backgroundColor,
      'color': 'white',
      'listStyleType': 'none',
      'transition': 'width .3s ease-in-out',
      'padding': theme.component.appShell.sidebar.spacing.padding,
      'rowGap': '1rem',
      'borderRight': `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
      'zIndex': 1,

      'selectors': {
        '&.collapsed': {
          width: theme.component.appShell.sidebar.spacing.width.collapsed,
          overflow: 'hidden',
          border: 'none',
        },
      },
      '@media': {
        'screen and (max-width: 1024px)': {
          position: 'absolute',
          width: theme.component.appShell.sidebar.spacing.width.main,
          left: 0,
          top: 0,
          bottom: 0,
          selectors: {
            '&.collapsed': {
              width: 0,
              paddingLeft: 0,
              paddingRight: 0,
              overflow: 'hidden',
              transition: 'width .3s ease-in-out',
            },
          },
        },
      },
    },
  },
})

export const app_main = style({
  '@layer': {
    [app]: {
      'position': 'relative',
      'top': 0,
      'right': 0,
      'width': '100%',
      'overflow': 'hidden',
      'height': '100%',
      'backgroundColor': theme.vars.component.content.backgroundColor.main,
      'zIndex': 0,
      'display': 'flex',
      'flexDirection': 'column',

      '@media': {
        '(max-width: 1024px)': {
          flexDirection: 'row',
        },
      },
    },
  },
})

export const app_content = style({
  '@layer': {
    [app]: {
      'position': 'relative',
      'bottom': 0,
      'right': 0,
      'height': '100%',
      'padding': `${size['size-4']} 8rem`,
      'width': '100%',
      'overflow': 'hidden',
      'display': 'flex',
      'flexDirection': 'column',

      '@media': {
        '(max-width: 1024px)': {
          padding: `${size['size-4']} ${size['size-4']}`,
        },
        '(max-width: 567px)': {
          display: 'block',
        },
      },
    },
  },
})

export const hamburger_wrapper = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      cursor: 'pointer',
      justifyContent: 'center',
      alignContent: 'center',
      flexWrap: 'wrap',
      height: theme.component.appShell.hamburger.wrapper.height,
      width: theme.component.appShell.hamburger.wrapper.width,

      selectors: {
        '&.open': {
          justifyContent: 'center',
        },
      },
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
      width: theme.component.appShell.hamburger.height,
      height: theme.component.appShell.hamburger.height,
    },
  },
})

export const hamburger_line = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: theme.component.appShell.hamburger.line.height,
      backgroundColor: theme.vars.typography.color.main,
      color: theme.vars.typography.color.main,
      transition: 'transform .3s, opacity .3s',
      transformOrigin: 'center',
      vars: {
        '--hamburger-line-margin': `calc((${theme.component.appShell.hamburger.height} - (${theme.component.appShell.hamburger.line.height} * 3)) / 2)`,
        '--hamburger-translate-y': `calc(var(--hamburger-line-margin) + ${theme.component.appShell.hamburger.line.height})`,
      },
      selectors: {
        '.open &:first-of-type': {
          transform: `translateY(var(--hamburger-translate-y)) rotate(-45deg)`,
        },
        '.open &:nth-of-type(2)': {
          opacity: '0',
        },
        '.open &:last-of-type': {
          transform: `translateY(calc(-1 * var(--hamburger-translate-y)))
      rotate(45deg)`,
        },
      },
    },
  },
})
