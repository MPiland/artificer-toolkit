import { style } from '@vanilla-extract/css'
import { app } from '@css/layers.css'
import { space } from '@css/size.css'
import { fontSize } from '@css/typography.css'
import { vars } from '@css/theme'

export const base = style({
  '@layer': {
    [app]: {
      padding: `${vars.spacing.md} ${vars.spacing.md}`,
      backgroundColor: vars.colors.white,

      selectors: {
        [vars.darkSelector]: {
          backgroundColor: vars.colors.dark[6],
        },
      },
    },
  },
})

export const groups = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: '100%',
      alignItems: 'center',
    },
  },
})

export const logo_icon = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
    },
  },
})

export const left_group = style({
  '@layer': {
    [app]: {
      justifyContent: 'flex-start',
      alignItems: 'center',
      height: '100%',
    },
  },
})

export const right_group = style({
  '@layer': {
    [app]: {
      justifyContent: 'flex-end',
      alignItems: 'center',
      height: '100%',
    },
  },
})

export const links = style({
  '@layer': {
    [app]: {
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    },
  },
})

export const link = style({
  '@layer': {
    [app]: {
      fontWeight: '500',
      textDecorationStyle: 'solid',
      height: '100%',
      padding: `0 ${vars.spacing.md}`,
      alignContent: 'center',
    },
  },
})

export const title = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      fontSize: fontSize['font-size-1'],
      textDecoration: 'none',
      cursor: 'pointer',
      color: vars.colors.text,
      gap: space['space-2'],
      userSelect: 'none',
      height: '100%',
    },
  },
})
