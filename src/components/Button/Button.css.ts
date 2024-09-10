import { createVar, globalStyle, style, styleVariants } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { theme } from '../../css/theme.css'
import { height } from '../../css/size.css'
import { borderRadius } from '../../css/border.css'
import { space } from '../../css/size.css'

export const button_background_color = createVar('button-background-color')
export const button_filled_hover = createVar('button-filled-hover')
export const button_outline_hover = createVar('button-outline-hover')

export const button = style({
  '@layer': {
    [app]: {
      position: 'relative',
      cursor: 'pointer',
      outline: 'none',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 0,
      padding: `${space['space-2']} ${space['space-4']}`,
      flexWrap: 'nowrap',
      textWrap: 'nowrap',
    },
  },
})

export const button_content = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      userSelect: 'none',
      zIndex: 0,
      width: '100%',
      pointerEvents: 'none',
    },
  },
})

export const button_color = styleVariants({
  primary: {
    vars: {
      [button_background_color]: theme.vars.button.primary.backgroundColor,
      [button_filled_hover]: theme.vars.button.primary.hoverBackgroundColor,
      [button_outline_hover]: theme.vars.button.primary.outlineHoverBackgroundColor,
    },
  },
  warning: {
    vars: {
      [button_background_color]: theme.vars.button.warning.backgroundColor,
      [button_filled_hover]: theme.vars.button.warning.hoverBackgroundColor,
      [button_outline_hover]: theme.vars.button.warning.outlineHoverBackgroundColor,
    },
  },
  danger: {
    vars: {
      [button_background_color]: theme.vars.button.danger.backgroundColor,
      [button_filled_hover]: theme.vars.button.danger.hoverBackgroundColor,
      [button_outline_hover]: theme.vars.button.danger.outlineHoverBackgroundColor,
    },
  },
  update: {
    vars: {
      [button_background_color]: theme.vars.button.update.backgroundColor,
      [button_filled_hover]: theme.vars.button.update.hoverBackgroundColor,
      [button_outline_hover]: theme.vars.button.update.outlineHoverBackgroundColor,
    },
  },
  default: {
    vars: {
      [button_background_color]: theme.vars.button.default.backgroundColor,
      [button_filled_hover]: theme.vars.button.default.hoverBackgroundColor,
      [button_outline_hover]: theme.vars.button.default.outlineHoverBackgroundColor,
    },
  },
})

export const button_style = styleVariants({
  unstyled: {
    padding: 0,
    backgroundColor: 'transparent',
    color: theme.vars.color,
    border: 'none',

    selectors: {
      '&:active': {
        backgroundColor: 'transparent',
      },
      '&:hover': {
        backgroundColor: 'transparent',
      },
      '&:focus': {
        backgroundColor: 'transparent',
      },
    },
  },
  filled: {
    color: 'white',
    border: 'none',
    backgroundColor: button_background_color,

    selectors: {
      '&:hover': {
        backgroundColor: button_filled_hover,
      },
      '&:active': {
        backgroundImage: 'linear-gradient(rgb(0 0 0/40%) 0 0)',
      },
    },
  },
  outline: {
    color: theme.vars.color,
    backgroundColor: 'transparent',
    border: `${theme.border} ${button_background_color}`,

    selectors: {
      '&:hover': {
        backgroundColor: button_outline_hover,
      },
    },
  },
})

export const button_height = styleVariants({
  default: { height: theme.button.height },
  auto: { height: height['auto'] },
  full: { height: height['full'] },
  xs: { height: height['xs'] },
  sm: { height: height['sm'] },
  md: { height: height['md'] },
  lg: { height: height['lg'] },
  xl: { height: height['xl'] },
})

export const button_radius = styleVariants({
  default: { borderRadius: theme.borderRadius },
  xs: { borderRadius: borderRadius['xs'] },
  sm: { borderRadius: borderRadius['sm'] },
  md: { borderRadius: borderRadius['md'] },
  lg: { borderRadius: borderRadius['lg'] },
  xl: { borderRadius: borderRadius['xl'] },
})

globalStyle(`${button} svg`, {
  '@layer': {
    [app]: {
      height: '100%',
      width: 'auto',
    },
  },
})
