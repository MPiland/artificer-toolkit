import { style } from '@vanilla-extract/css'
import { app } from '@css/layers.css'
import { vars } from '@css/theme'

export const base = style({
  '@layer': {
    [app]: {
      padding: `${vars.spacing.sm} ${vars.spacing.md}`,
      backgroundColor: vars.colors.body,
      borderBottom: `1px solid var(--app-shell-border-color)`,
    },
  },
})

export const groups = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: '100%',
      alignItems: 'center',
      gap: vars.spacing.sm,
    },
  },
})

export const logo_icon = style({
  '@layer': {
    [app]: {
      width: '1.25rem',
      height: '1.25rem',
      color: 'var(--at-accent)',
      flexShrink: 0,
    },
  },
})

export const left_group = style({
  '@layer': {
    [app]: {
      justifyContent: 'flex-start',
      alignItems: 'center',
      minWidth: 0,
      flex: '0 1 auto',
    },
  },
})

export const right_group = style({
  '@layer': {
    [app]: {
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: vars.spacing.sm,
      marginLeft: 'auto',
    },
  },
})

export const utility_group = style({
  '@layer': {
    [app]: {
      marginLeft: 'auto',
      alignItems: 'center',
      gap: vars.spacing.sm,
    },
  },
})

export const links = style({
  '@layer': {
    [app]: {
      justifyContent: 'center',
      alignItems: 'center',
      gap: vars.spacing.xs,
      marginLeft: 'auto',
    },
  },
})

export const link = style({
  '@layer': {
    [app]: {
      padding: `${vars.spacing.xs} ${vars.spacing.sm}`,
      borderRadius: vars.radius.sm,
      color: vars.colors.dimmed,
      fontWeight: 500,
      textDecoration: 'none',
      transition: 'background-color 120ms ease, color 120ms ease',
      selectors: {
        '&:hover': {
          backgroundColor: vars.colors.defaultHover,
          color: vars.colors.text,
        },
      },
    },
  },
})

export const title = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
      fontSize: vars.fontSizes.md,
      fontWeight: 650,
      letterSpacing: '-0.02em',
      textDecoration: 'none',
      cursor: 'pointer',
      color: vars.colors.text,
      gap: vars.spacing.xs,
      userSelect: 'none',
      selectors: {
        '&:hover': {
          color: vars.colors.text,
        },
      },
    },
  },
})
