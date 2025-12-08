import { style } from '@vanilla-extract/css'
import { app } from '~css/layers.css'
import { vars } from '~css/theme'

export const base = style({
  '@layer': {
    [app]: {
      'overflow': 'hidden',
      'vars': {
        '--app-shell-border-color': vars.colors.gray[5],
        '--icon-width': '1.875rem',
      },
      'selectors': {
        [vars.darkSelector]: {
          vars: {
            '--app-shell-border-color': vars.colors.dark[3],
          },
        },
        '&:not(.collapsed)': {
          vars: {
            '--app-shell-navbar-transform': 'translateX(0)',
          },
        },
      },
      '@media': {
        '(min-width: 992px)': {
          selectors: {
            '&:not(.unAuth).collapsed': {
              vars: {
                '--mini-navbar-width': 'calc((var(--mantine-spacing-md) * 2) + var(--icon-width))',
                '--app-shell-navbar-offset': 'calc((var(--mantine-spacing-md) * 2) + var(--icon-width))',
                '--app-shell-navbar-transform':
                  'translateX(calc(-1 * var(--app-shell-navbar-width) + var(--mini-navbar-width)))',
                '--app-shell-navbar-transform-rtl':
                  'translateX(calc(var(--app-shell-navbar-width) - var(--mini-navbar-width)))',
              },
            },
          },
        },
      },
    },
  },
})

export const main = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      overflow: 'hidden',
    },
  },
})
