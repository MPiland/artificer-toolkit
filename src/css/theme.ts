import { createTheme, CSSVariablesResolver } from '@mantine/core'
import { themeToVars } from '@mantine/vanilla-extract'

export const theme = createTheme({
  other: {
    border: {
      width: {
        thin: '1px',
        wide: '2px',
      },
      style: 'solid',
      color: 'var(--border-color)',
    },
  },
})

export const vars = themeToVars(theme)

export const resolver: CSSVariablesResolver = (theme) => ({
  variables: {},
  light: {
    '--border-color': theme.colors.dark[5],
    '--mantine-color-text': vars.colors.dark[5],
  },
  dark: {
    '--border-color': theme.colors.gray[4],
  },
})
