import { style } from '@vanilla-extract/css'
import { app } from '~/css/layers.css'
import { vars, theme } from '~/css/theme'
import { base as layout } from '../Layout.css'

export const base = style({
  '@layer': {
    [app]: {
      'selectors': {
        [vars.darkSelector]: {
          backgroundColor: vars.colors.dark[6],
        },
      },
      '@media': {
        '(max-width: 576px)': {
          borderRight: 'none',
        },
      },
    },
  },
})

export const header = style({
  '@layer': {
    [app]: {
      padding: `${vars.spacing.md} ${vars.spacing.md}`,
      paddingBottom: vars.spacing.xs,
    },
  },
})

export const links = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      alignItems: 'end',
      padding: `${vars.spacing.md} 0`,
    },
  },
})

export const link = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'width': '100%',
      'alignItems': 'center',
      'gap': vars.spacing.xs,
      'overflow': 'hidden',
      'color': `${vars.colors.dark[4]}`,
      'padding': `${vars.spacing.xs} ${vars.spacing.md}`,
      'height': 'fit-content',
      'vars': {
        '--navbar-link-hover-bg': vars.colors.gray[3],
      },
      'selectors': {
        [vars.darkSelector]: {
          color: `${vars.colors.blue[3]}`,
          vars: {
            '--navbar-link-hover-bg': vars.colors.dark[5],
          },
        },
        '&:hover': {
          backgroundColor: 'var(--navbar-link-hover-bg)',
        },
      },
      '@media': {
        '(min-width: 769px)': {
          selectors: {
            [`${layout}:not(.unAuth).collapsed &`]: {
              justifyContent: 'end',
            },
          },
        },
      },
    },
  },
})

export const link_icon_wrapper = style({
  '@layer': {
    [app]: {
      minWidth: 'var(--icon-width)',
      width: 'var(--icon-width)',
      height: 'var(--icon-width)',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  },
})

export const link_icon = style({
  '@layer': {
    [app]: {
      height: '1.875rem',
      width: '1.875rem',
      strokeWidth: '1.5px',
      flexShrink: 0,
    },
  },
})

export const link_label = style({
  '@layer': {
    [app]: {
      'overflow': 'hidden',
      'userSelect': 'none',
      'whiteSpace': 'nowrap',
      'transition': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      'maxWidth': '10rem',
      '@media': {
        '(min-width: 769px)': {
          selectors: {
            [`${layout}:not(.unAuth).collapsed &`]: {
              width: 0,
              opacity: 0,
              marginLeft: 0,
              pointerEvents: 'none',
              display: 'none',
            },
          },
        },
      },
    },
  },
})

export const link_tooltip = style({
  '@layer': {
    [app]: {
      backgroundColor: vars.colors.body,
      color: vars.colors.text,
      border: `${theme.other?.border.width.thin} ${theme.other?.border.style} var(--app-shell-border-color)`,
    },
  },
})

export const footer = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      borderTop: '1px solid var(--app-shell-border-color)',
    },
  },
})
