import { createVar, globalStyle, style, styleVariants } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { theme } from '../../css/theme.css'
import { height } from '../../css/size.css'
import { borderRadius } from '../../css/border.css'
import { space } from '../../css/size.css'

export const button_background_color = createVar('button-background-color')
export const button_filled_hover = createVar('button-filled-hover')
export const button_outline_hover = createVar('button-outline-hover')
export const button_width = createVar('button-width')

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
      overflow: 'hidden',
      width: button_width,
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
      overflow: 'hidden',
    },
  },
})

export const button_color = styleVariants({
  primary: {
    '@layer': {
      [app]: {
        vars: {
          [button_background_color]: theme.vars.component.button.backgroundColor.primary.main,
          [button_filled_hover]: theme.vars.component.button.backgroundColor.primary.hover,
          [button_outline_hover]: theme.vars.component.button.backgroundColor.primary.outlineHover,
        },
      },
    },
  },
  warning: {
    '@layer': {
      [app]: {
        vars: {
          [button_background_color]: theme.vars.component.button.backgroundColor.warning.main,
          [button_filled_hover]: theme.vars.component.button.backgroundColor.warning.hover,
          [button_outline_hover]: theme.vars.component.button.backgroundColor.warning.outlineHover,
        },
      },
    },
  },
  danger: {
    '@layer': {
      [app]: {
        vars: {
          [button_background_color]: theme.vars.component.button.backgroundColor.danger.main,
          [button_filled_hover]: theme.vars.component.button.backgroundColor.danger.hover,
          [button_outline_hover]: theme.vars.component.button.backgroundColor.danger.outlineHover,
        },
      },
    },
  },
  update: {
    '@layer': {
      [app]: {
        vars: {
          [button_background_color]: theme.vars.component.button.backgroundColor.update.main,
          [button_filled_hover]: theme.vars.component.button.backgroundColor.update.hover,
          [button_outline_hover]: theme.vars.component.button.backgroundColor.update.outlineHover,
        },
      },
    },
  },
  main: {
    '@layer': {
      [app]: {
        vars: {
          [button_background_color]: theme.vars.component.button.backgroundColor.main.main,
          [button_filled_hover]: theme.vars.component.button.backgroundColor.main.hover,
          [button_outline_hover]: theme.vars.component.button.backgroundColor.main.outlineHover,
        },
      },
    },
  },
})

export const button_style = styleVariants({
  unstyled: {
    '@layer': {
      [app]: {
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
    },
  },
  filled: {
    '@layer': {
      [app]: {
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
    },
  },
  outline: {
    '@layer': {
      [app]: {
        color: theme.vars.typography.color.main,
        backgroundColor: 'transparent',
        border: `${theme.border.size.main} ${theme.border.style} ${button_background_color}`,

        selectors: {
          '&:hover': {
            backgroundColor: button_outline_hover,
          },
        },
      },
    },
  },
})

export const button_height = styleVariants({
  default: { '@layer': { [app]: { height: theme.component.button.height } } },
  auto: { '@layer': { [app]: { height: height['auto'] } } },
  full: { '@layer': { [app]: { height: height['full'] } } },
  xs: { '@layer': { [app]: { height: height['xs'] } } },
  sm: { '@layer': { [app]: { height: height['sm'] } } },
  md: { '@layer': { [app]: { height: height['md'] } } },
  lg: { '@layer': { [app]: { height: height['lg'] } } },
  xl: { '@layer': { [app]: { height: height['xl'] } } },
})

export const button_radius = styleVariants({
  default: { '@layer': { [app]: { borderRadius: theme.border.radius } } },
  xs: { '@layer': { [app]: { borderRadius: borderRadius['xs'] } } },
  sm: { '@layer': { [app]: { borderRadius: borderRadius['sm'] } } },
  md: { '@layer': { [app]: { borderRadius: borderRadius['md'] } } },
  lg: { '@layer': { [app]: { borderRadius: borderRadius['lg'] } } },
  xl: { '@layer': { [app]: { borderRadius: borderRadius['xl'] } } },
})

globalStyle(`${button} svg`, {
  '@layer': {
    [app]: {
      height: 'auto',
      width: '100%',
    },
  },
})
