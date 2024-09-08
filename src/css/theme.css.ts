import { createGlobalTheme, createThemeContract, createTheme } from '@vanilla-extract/css'
import './layers.css'
import './reset.css'
import './app.css'
import { lightColors, darkColors } from './colors.css'
import { borderRadius, borderSize } from './border.css'
import { height } from './size.css'

export const root = createGlobalTheme(':root', {
  borderRadius: borderRadius['sm'],
  border: `${borderSize['border-size-1']} solid`,
  button: {
    height: height['sm'],
  },
  input: {
    height: height['sm'],
  },
  appShell: {
    sidebar: {
      'padding': '1rem .5rem',
      'item-height': '2.5rem',
      'collapsed-width': '3.5rem',
      'header': {
        height: height['md'],
      },
      'width': '14rem',
    },
    header: {
      padding: '1rem 1rem',
      height: `calc(${height['md']} + 2rem)`,
    },
  },
  hamburger: {
    height: 'calc(.5rem * 3)',
    line: {
      height: 'calc(.5rem / 2.25)',
    },
    wrapper: {
      height: '2.5rem',
      width: '2.5rem',
    },
  },
  color: {
    error: `2px solid ${lightColors['red7']}`,
    focus: `2px solid ${lightColors['blue7']}`,
  },
})

export const vars = createThemeContract({
  backgroundColor: {
    component: null,
    content: null,
    sidebar: null,
  },
  borderColor: null,
  button: {
    primary: {
      backgroundColor: null,
      hoverBackgroundColor: null,
      outlineHoverBackgroundColor: null,
    },
    warning: {
      backgroundColor: null,
      hoverBackgroundColor: null,
      outlineHoverBackgroundColor: null,
    },
    danger: {
      backgroundColor: null,
      hoverBackgroundColor: null,
      outlineHoverBackgroundColor: null,
    },
    update: {
      backgroundColor: null,
      hoverBackgroundColor: null,
      outlineHoverBackgroundColor: null,
    },
    default: {
      backgroundColor: null,
      hoverBackgroundColor: null,
      outlineHoverBackgroundColor: null,
    },
  },
  card: {
    header: null,
  },
  color: null,
  input: {
    focusBorder: null,
  },
})

export const light = createTheme(vars, {
  backgroundColor: {
    content: lightColors['slate1'],
    component: lightColors['slate2'],
    sidebar: lightColors['slate3'],
  },
  borderColor: lightColors['slate6'],
  button: {
    primary: {
      backgroundColor: lightColors['blue9'],
      hoverBackgroundColor: lightColors['blue10'],
      outlineHoverBackgroundColor: lightColors['blue3'],
    },
    warning: {
      backgroundColor: lightColors['yellow9'],
      hoverBackgroundColor: lightColors['yellow10'],
      outlineHoverBackgroundColor: lightColors['yellow3'],
    },
    danger: {
      backgroundColor: lightColors['red9'],
      hoverBackgroundColor: lightColors['red10'],
      outlineHoverBackgroundColor: lightColors['red3'],
    },
    update: {
      backgroundColor: lightColors['green9'],
      hoverBackgroundColor: lightColors['green10'],
      outlineHoverBackgroundColor: lightColors['green3'],
    },
    default: {
      backgroundColor: lightColors['slate9'],
      hoverBackgroundColor: lightColors['slate10'],
      outlineHoverBackgroundColor: lightColors['slate3'],
    },
  },
  card: {
    header: lightColors['slate4'],
  },
  color: lightColors['slate12'],
  input: {
    focusBorder: `2px solid ${lightColors['blue7']}`,
  },
})

export const dark = createTheme(vars, {
  backgroundColor: {
    content: darkColors['slate1'],
    component: darkColors['slate2'],
    sidebar: darkColors['slate3'],
  },
  borderColor: darkColors['slate6'],
  button: {
    primary: {
      backgroundColor: darkColors['blue9'],
      hoverBackgroundColor: darkColors['blue10'],
      outlineHoverBackgroundColor: darkColors['blue3'],
    },
    warning: {
      backgroundColor: darkColors['yellow9'],
      hoverBackgroundColor: darkColors['yellow10'],
      outlineHoverBackgroundColor: darkColors['yellow3'],
    },
    danger: {
      backgroundColor: darkColors['red9'],
      hoverBackgroundColor: darkColors['red10'],
      outlineHoverBackgroundColor: darkColors['red3'],
    },
    update: {
      backgroundColor: darkColors['green9'],
      hoverBackgroundColor: darkColors['green10'],
      outlineHoverBackgroundColor: darkColors['green3'],
    },
    default: {
      backgroundColor: darkColors['slate9'],
      hoverBackgroundColor: darkColors['slate10'],
      outlineHoverBackgroundColor: darkColors['slate3'],
    },
  },
  card: {
    header: darkColors['slate4'],
  },
  color: darkColors['slate11'],
  input: {
    focusBorder: `2px solid ${darkColors['blue7']}`,
  },
})

export const theme = { ...root, vars }

export type Theme = typeof theme
export type ButtonColor = keyof typeof vars.button
