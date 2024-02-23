import {
  createGlobalTheme,
  createTheme,
  createThemeContract,
} from '@vanilla-extract/css'
import { palette } from './colors.css'
import './layers.css'
import './reset.css'
import './app.css'

export const root = createGlobalTheme(':root', {
  //App
  'doc-height': '100vh',
  'header-height': '4rem',
  'footer-height': '3rem',
  'default-border-radius': '.25rem',

  //Input
  'input-height': '2.5rem',
  'input-width': '100%',
  'input-border': '1px solid grey',
  'input-label-font-weight': '600',

  //Buttons
  'button-height': '2.5rem',
  'button-width': '100%',

  //Sidebar
  'sidebar-width': '12rem',
  'hamburger-wrapper-width': 'calc(.5rem * 3)',
  'hamburger-line-height': 'calc(.5rem / 2.25)',
})

export const vars = createThemeContract({
  //App
  'app-background-color': null,
  'app-color': null,
  'app-border-line-style': null,
  'focus-border': null,
  'input': {
    'input-error-color': null,
  },
})

export const light = createTheme(vars, {
  'app-background-color': 'white',
  'app-color': 'black',
  'app-border-line-style': `1px solid ${palette['gray-6']}`,
  'focus-border': '2px solid rgb(99, 162, 235)',

  'input': {
    'input-error-color': 'red',
  },
})

export const theme = { ...root, vars }
