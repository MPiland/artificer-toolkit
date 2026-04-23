import { style } from '@vanilla-extract/css'
import { app } from '@css/layers.css'
import { vars, theme } from '@css/theme'

export const base = style({
  '@layer': {
    [app]: {
      backgroundColor: vars.colors.body,
      borderRight: '1px solid var(--app-shell-border-color)',
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
      padding: `${vars.spacing.sm} ${vars.spacing.md}`,
      paddingBottom: vars.spacing.xs,
    },
  },
})

export const links = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '4px',
      padding: `${vars.spacing.sm} ${vars.spacing.xs}`,
    },
  },
})

export const link = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: vars.spacing.sm,
      width: '100%',
      minHeight: '48px',
      padding: '4px 12px',
      borderRadius: '12px',
      color: vars.colors.dimmed,
      textDecoration: 'none',
      transition: 'background-color 120ms ease, color 120ms ease',
      selectors: {
        '&:hover': {
          backgroundColor: vars.colors.defaultHover,
          color: vars.colors.text,
        },
        '&[data-active="true"]': {
          color: vars.colors.text,
        },
      },
      '@media': {
        '(min-width: 992px)': {
          width: '72px',
          justifyContent: 'center',
          padding: '4px 12px',
        },
      },
    },
  },
})

export const link_pill = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '48px',
      height: '40px',
      borderRadius: '8px',
      border: '1px solid transparent',
      transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
      selectors: {
        [`${link}:hover &`]: {
          backgroundColor: 'var(--at-accent-muted)',
          borderColor: 'var(--at-border-subtle)',
        },
        [`${link}[data-active="true"] &`]: {
          backgroundColor: 'rgba(151, 185, 175, 0.18)',
          borderColor: 'var(--at-accent-border)',
        },
      },
    },
  },
})

export const link_icon_wrapper = style({
  '@layer': {
    [app]: {
      width: '24px',
      height: '24px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: 'translateY(-0.5px)',
      color: 'var(--at-text-secondary)',
      selectors: {
        [`${link}:hover &`]: {
          color: 'var(--at-accent)',
        },
        [`${link}[data-active="true"] &`]: {
          color: 'var(--at-accent)',
        },
      },
    },
  },
})

export const link_icon = style({
  '@layer': {
    [app]: {
      width: '20px',
      height: '20px',
      strokeWidth: '1.6px',
      flexShrink: 0,
    },
  },
})

export const link_label = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      fontSize: vars.fontSizes.sm,
      fontWeight: 500,
      color: vars.colors.text,
      '@media': {
        '(min-width: 992px)': {
          display: 'none',
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
      borderRadius: '8px',
      boxShadow: 'var(--at-shadow-card)',
      padding: '6px 10px',
      fontSize: '12px',
    },
  },
})

export const footer = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      borderTop: '1px solid var(--app-shell-border-color)',
      marginTop: 'auto',
    },
  },
})
