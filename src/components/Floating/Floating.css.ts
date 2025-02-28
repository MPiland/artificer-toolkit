import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'
import { theme } from '../../css/theme.css'

export const floating_content = style({
  '@layer': {
    [app]: {
      backgroundColor: theme.vars.component.floating.backgroundColor.main,
      borderRadius: theme.border.radius,
      border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
      padding: size['size-2'],
      zIndex: 10000,
      color: theme.vars.typography.color.main,

      selectors: {
        '&.invalid': {
          borderColor: theme.vars.component.content.border.color.error,
          backgroundColor: theme.vars.component.floating.backgroundColor.error,
          color: theme.vars.typography.color.error,
        },
      },
    },
  },
})

export const floating_arrow = style({
  '@layer': {
    [app]: {
      backgroundColor: 'transparent',
      fill: theme.vars.component.content.border.color.main,

      selectors: {
        '&.invalid': {
          fill: theme.vars.component.content.border.color.error,
        },
      },
    },
  },
})

export const floating_nowrapper = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: 'inherit',
    },
  },
})

export const floating_option = style({
  '@layer': {
    [app]: {
      cursor: 'default',
      padding: `${size['size-1']} ${size['size-3']}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',

      selectors: {
        '&:focus': {
          outline: 'none',
          backgroundColor: 'rgb(118, 184, 255)',
          borderRadius: theme.border.radius,
        },
        // '&:hover': {
        //   backgroundColor: 'rgb(118, 184, 255)',
        //   borderRadius: theme.border.radius,
        // },
      },
    },
  },
})

export const floating_option_right_side = style({
  width: '1rem',
  marginLeft: size['size-2'],
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'row',
})
