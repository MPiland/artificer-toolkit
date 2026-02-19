import { style } from '@vanilla-extract/css'
import { app } from '@css/layers.css'
import { vars } from '@css/theme'
import { base as layout } from '../Layout.css'

export const base = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'alignItems': 'center',
      'padding': vars.spacing.md,
      'color': vars.colors.text,
      'overflow': 'hidden',
      'width': '100%',
      'vars': {
        '--user-button-hover-bg': vars.colors.gray[4],
      },
      'selectors': {
        [vars.darkSelector]: {
          vars: {
            '--user-button-hover-bg': vars.colors.dark[5],
          },
        },
        [`${layout}.collapsed &`]: {
          gap: 0,
        },
        '&:hover': {
          backgroundColor: 'var(--user-button-hover-bg)',
        },
      },
      '@media': {
        '(min-width: 769px)': {
          selectors: {
            [`${layout}.collapsed &`]: {
              justifyContent: 'end',
            },
          },
        },
      },
    },
  },
})

export const avatar = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 'var(--icon-width)',
      width: 'var(--icon-width)',
    },
  },
})

export const avatar_img = style({
  '@layer': {
    [app]: {
      width: '1.875rem',
      height: '1.875rem',
      borderRadius: vars.radius.xl,
    },
  },
})
export const label_container = style({
  '@layer': {
    [app]: {
      '@media': {
        '(min-width: 769px)': {
          selectors: {
            [`${layout}.collapsed &`]: {
              display: 'none',
            },
          },
        },
      },
    },
  },
})

export const label = style({
  '@layer': {
    [app]: {
      flex: 1,
    },
  },
})

export const title = style({
  '@layer': {
    [app]: {
      fontWeight: 500,
      fontSize: vars.fontSizes.sm,
      userSelect: 'none',
    },
  },
})

export const email = style({
  '@layer': {
    [app]: {
      fontSize: vars.fontSizes.xs,
      color: vars.colors.dimmed,
      userSelect: 'none',
      selectors: {
        [`${layout}.collapsed &`]: {
          display: 'none',
        },
      },
    },
  },
})

export const chevron = style({
  '@layer': {
    [app]: {
      width: '14px',
      height: '14px',
      strokeWidth: '1.5px',
      selectors: {
        [`${layout}.collapsed &`]: {
          display: 'none',
        },
      },
    },
  },
})

export const menu = style({
  '@layer': {
    [app]: {
      width: 'fit-content',
      borderColor: 'var(--user-menu-border-color)',
      vars: {
        '--user-menu-border-color': vars.colors.gray[5],
      },
      selectors: {
        [vars.darkSelector]: {
          vars: {
            '--user-menu-border-color': vars.colors.dark[3],
          },
        },
        '&.mantine-Menu-dropdown': {
          width: 'fit-content',
        },
      },
    },
  },
})
