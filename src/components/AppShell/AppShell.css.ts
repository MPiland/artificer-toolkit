import { theme } from '../../css/theme.css'
import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const app_shell = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      height: '100dvh',
      width: '100%',
      overflow: 'hidden',
      color: theme.vars.color,
    },
  },
})

export const app_header = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      top: 0,
      right: 0,
      width: 'auto',
      height: theme.appShell.header.height,
      display: 'flex',
      flexDirection: 'row',
      border: 'none',
      borderBottom: `${theme.border} ${theme.vars.borderColor}`,
      padding: theme.appShell.header.padding,
      backgroundColor: theme.vars.backgroundColor.content,
      color: theme.vars.color,
    },
  },
})

export const app_sidebar = style({
  '@layer': {
    [app]: {
      position: 'relative',
      left: 0,
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: theme.appShell.sidebar.width,
      backgroundColor: theme.vars.backgroundColor.sidebar,
      color: 'white',
      listStyleType: 'none',
      transition: 'width .3s ease-in-out',
      padding: theme.appShell.sidebar.padding,
      rowGap: '1rem',
      borderRight: `${theme.border} ${theme.vars.borderColor}`,

      selectors: {
        '&.collapsed': {
          width: theme.appShell.sidebar['collapsed-width'],
          overflow: 'hidden',
        },
      },
    },
  },
})

export const app_main = style({
  '@layer': {
    [app]: {
      position: 'relative',
      top: 0,
      right: 0,
      width: '100%',
      overflow: 'hidden',
      height: '100%',
      backgroundColor: theme.vars.backgroundColor.content,
      zIndex: 0,
    },
  },
})

export const app_content = style({
  '@layer': {
    [app]: {
      padding: `${size['size-4']} 8rem`,
      width: '100%',
      height: `calc(100% - ${theme.appShell.header.height})`,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
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
      height: theme.hamburger.wrapper.height,
      width: theme.hamburger.wrapper.width,

      selectors: {
        '&.collapsed': {
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
      width: theme.hamburger.height,
      height: theme.hamburger.height,
    },
  },
})

export const hamburger_line = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: theme.hamburger.line.height,
      backgroundColor: theme.vars.color,
      transition: 'transform .3s, opacity .3s',
      transformOrigin: 'center',
      vars: {
        '--hamburger-line-margin': `calc((${theme.hamburger.height} - (${theme.hamburger.line.height} * 3)) / 2)`,
        '--hamburger-translate-y': `calc(var(--hamburger-line-margin) + ${theme.hamburger.line.height})`,
      },
      selectors: {
        '.collapsed &:first-of-type': {
          transform: `translateY(var(--hamburger-translate-y)) rotate(45deg)`,
        },
        '.collapsed &:nth-of-type(2)': {
          opacity: '0',
        },
        '.collapsed &:last-of-type': {
          transform: `translateY(calc(-1 * var(--hamburger-translate-y)))
      rotate(-45deg)`,
        },
      },
    },
  },
})
