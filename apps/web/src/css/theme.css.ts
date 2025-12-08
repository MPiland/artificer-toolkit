import { globalStyle } from '@vanilla-extract/css'
import { vars } from './theme'
import { app } from './layers.css'

globalStyle(`:root[data-mantine-color-scheme="dark"]`, {
  '@layer': {
    [app]: {
      vars: {
        '--mantine-color-text': vars.colors.white,
      },
    },
  },
})
