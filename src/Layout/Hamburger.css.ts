import { theme } from '../css/theme.css'
import { style } from '@vanilla-extract/css'
import { app } from '../css/layers.css'

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
