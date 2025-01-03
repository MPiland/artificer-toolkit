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
      [button_background_color]: theme.vars.component.button.backgroundColor.primary.main,
      [button_filled_hover]: theme.vars.component.button.backgroundColor.primary.hover,
      [button_outline_hover]: theme.vars.component.button.backgroundColor.primary.outlineHover,
    },
  },
  warning: {
    vars: {
      [button_background_color]: theme.vars.component.button.backgroundColor.warning.main,
      [button_filled_hover]: theme.vars.component.button.backgroundColor.warning.hover,
      [button_outline_hover]: theme.vars.component.button.backgroundColor.warning.outlineHover,
    },
  },
  danger: {
    vars: {
      [button_background_color]: theme.vars.component.button.backgroundColor.danger.main,
      [button_filled_hover]: theme.vars.component.button.backgroundColor.danger.hover,
      [button_outline_hover]: theme.vars.component.button.backgroundColor.danger.outlineHover,
    },
  },
  update: {
    vars: {
      [button_background_color]: theme.vars.component.button.backgroundColor.update.main,
      [button_filled_hover]: theme.vars.component.button.backgroundColor.update.hover,
      [button_outline_hover]: theme.vars.component.button.backgroundColor.update.outlineHover,
    },
  },
  main: {
    vars: {
      [button_background_color]: theme.vars.component.button.backgroundColor.main.main,
      [button_filled_hover]: theme.vars.component.button.backgroundColor.main.hover,
      [button_outline_hover]: theme.vars.component.button.backgroundColor.main.outlineHover,
    },
  },
})

export const button_style = styleVariants({
  unstyled: {
    padding: 0,
    backgroundColor: 'transparent',
    color: theme.vars.typography.color.main,
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
    color: theme.vars.typography.color.main,
    backgroundColor: 'transparent',
    border: `${theme.border.size.main} ${theme.border.style} ${button_background_color}`,

    selectors: {
      '&:hover': {
        backgroundColor: button_outline_hover,
      },
    },
  },
})

console.log({ button_background_color })

export const button_height = styleVariants({
  default: { height: theme.component.button.height },
  auto: { height: height['auto'] },
  full: { height: height['full'] },
  xs: { height: height['xs'] },
  sm: { height: height['sm'] },
  md: { height: height['md'] },
  lg: { height: height['lg'] },
  xl: { height: height['xl'] },
})

export const button_radius = styleVariants({
  default: { borderRadius: theme.border.radius },
  xs: { borderRadius: borderRadius['xs'] },
  sm: { borderRadius: borderRadius['sm'] },
  md: { borderRadius: borderRadius['md'] },
  lg: { borderRadius: borderRadius['lg'] },
  xl: { borderRadius: borderRadius['xl'] },
})

globalStyle(`${button} svg`, {
  '@layer': {
    [app]: {
      height: 'auto',
      width: '100%',
    },
  },
})
