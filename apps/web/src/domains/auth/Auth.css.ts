import { style } from '@vanilla-extract/css'
import { vars } from '~css/theme'
import { app } from '~css/layers.css'

export const auth_container = style({
  '@layer': {
    [app]: {
      selectors: {
        '&.mantine-Container-root': {
          marginBlock: 'auto',
        },
      },
    },
  },
})

export const social_icon = style({
  '@layer': {
    [app]: {
      width: '14px',
      height: '14px',
    },
  },
})

export const auth_title = style({
  '@layer': {
    [app]: {
      fontSize: '26px',
      fontWeight: '500',
      fontFamily: 'Outfit, var(--mantine-font-family)',
    },
  },
})

export const auth_subtitle = style({
  '@layer': {
    [app]: {
      color: vars.colors.dimmed,
      fontSize: vars.fontSizes.sm,
      textAlign: 'center',
      marginTop: '-1rem',
    },
  },
})

export const auth_wrapper = style({
  '@layer': {
    [app]: {
      maxWidth: '400px',
    },
  },
})

export const auth_link = style({
  '@layer': {
    [app]: {
      fontSize: vars.fontSizes.sm,
    },
  },
})

export const fp_controls = style({
  '@layer': {
    [app]: {
      '@media': {
        [`(max-width: ${vars.breakpoints.xs})`]: {
          flexDirection: 'column-reverse',
        },
      },
    },
  },
})

export const fp_control = style({
  '@layer': {
    [app]: {
      '@media': {
        [`(max-width: ${vars.breakpoints.xs})`]: {
          width: '100%',
          textAlign: 'center',
        },
      },
    },
  },
})

export const fp_arrow = style({
  '@layer': {
    [app]: {
      width: '.75rem',
      height: '.75rem',
      marginRight: '0.25rem',
    },
  },
})
