import { createVar, globalStyle, style, styleVariants } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { theme } from '../../css/theme.css'
import { height } from '../../css/size.css'
import { borderRadius } from '../../css/border.css'
import { space, size } from '../../css/size.css'

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
      overflow: 'hidden',
    },
  },
})

const colors = {
  primary: 'primary',
  warning: 'warning',
  danger: 'danger',
  update: 'update',
  main: 'main',
} as const

export const button_color = styleVariants(colors, (colorValue: keyof typeof colors) => [
  button,
  {
    '@layer': {
      [app]: {
        vars: {
          [button_background_color]: theme.vars.component.button.backgroundColor[colorValue].main,
          [button_filled_hover]: theme.vars.component.button.backgroundColor[colorValue].hover,
          [button_outline_hover]: theme.vars.component.button.backgroundColor[colorValue].outlineHover,
        },
      },
    },
  },
])

export const button_style = styleVariants({
  unstyled: {
    '@layer': {
      [app]: {
        padding: 0,
        backgroundColor: 'transparent',
        color: theme.vars.typography.color.main,
        border: 'none',

        selectors: {
          '&:disabled': {
            cursor: 'not-allowed',
            opacity: 0.6,
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
          '&:not(:disabled):hover': {
            backgroundColor: button_filled_hover,
          },
          '&:not(:disabled):active': {
            backgroundImage: 'linear-gradient(rgb(0 0 0/40%) 0 0)',
          },
          '&:disabled': {
            cursor: 'not-allowed',
            opacity: 0.6,
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
          '&:not(:disabled):hover': {
            backgroundColor: button_outline_hover,
          },
          '&:disabled': {
            cursor: 'not-allowed',
            opacity: 0.6,
          },
        },
      },
    },
  },
})

const heightKeys = {
  default: 'default',
  ...height,
} as const

export const button_height = styleVariants(heightKeys, (heightValue: (typeof heightKeys)[keyof typeof heightKeys]) => {
  if (heightValue === 'default') {
    return [
      button,
      {
        '@layer': {
          [app]: {
            height: theme.component.button.height,
          },
        },
      },
    ]
  } else {
    return [button, { '@layer': { [app]: { height: heightValue } } }]
  }
})

const radiusKeys = {
  default: 'default',
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
} as const

export const button_radius = styleVariants(radiusKeys, (radiusValue: keyof typeof radiusKeys) => {
  if (radiusValue === 'default') {
    return [
      button,
      {
        '@layer': {
          [app]: {
            borderRadius: theme.border.radius,
          },
        },
      },
    ]
  } else {
    return [button, { '@layer': { [app]: { borderRadius: borderRadius[radiusValue] } } }]
  }
})

export const button_width = styleVariants(size, (sizeValue) => [button, { '@layer': { [app]: { width: sizeValue } } }])

export const button_content = style({
  '@layer': {
    [app]: {
      position: 'relative',
      height: '100%',
      alignItems: 'center',
      userSelect: 'none',
      zIndex: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'row',

      selectors: {
        [`${button}${button_width['size-full']} > &`]: {
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          display: 'unset',
          alignContent: 'center',
          flex: 1,
        },
      },
    },
  },
})

globalStyle(`${button} svg`, {
  '@layer': {
    [app]: {
      height: '100%',
      width: 'auto',
    },
  },
})
