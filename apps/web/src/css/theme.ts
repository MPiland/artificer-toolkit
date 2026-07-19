import { Button, createTheme, CSSVariablesResolver } from '@mantine/core'
import { themeToVars } from '@mantine/vanilla-extract'
import { brandColorScale, foundationVars } from './foundations.css.ts'

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 5,
  colors: {
    brand: [...brandColorScale]
  },
  fontFamily: foundationVars.font.sans,
  headings: {
    fontFamily: foundationVars.font.display,
    fontWeight: '650'
  },
  fontFamilyMonospace: foundationVars.font.mono,
  radius: foundationVars.radius,
  defaultRadius: 'lg',
  components: {
    Button: Button.extend({
      vars: (_theme, props) => {
        const button =
          props.variant === 'filled'
            ? foundationVars.color.button.primary
            : props.variant === 'default'
              ? foundationVars.color.button.secondary
              : undefined

        if (!button) return { root: {} }

        return {
          root: {
            '--button-bg': button.background,
            '--button-hover': button.hover,
            '--button-hover-color': button.text,
            '--button-color': button.text,
            '--button-bd': `1px solid ${button.border}`
          }
        }
      }
    })
  },
  other: {
    border: {
      width: { thin: '1px', wide: '2px' },
      style: 'solid',
      color: foundationVars.color.border.strong
    }
  }
})

export const vars = themeToVars(theme)

export const resolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--border-color': foundationVars.color.border.strong,
    '--mantine-color-text': foundationVars.color.text.primary,
    '--mantine-color-body': foundationVars.color.surface.canvas,
    '--mantine-color-default-border': foundationVars.color.border.strong,
    '--mantine-color-brand-filled': foundationVars.color.button.primary.background,
    '--mantine-color-brand-filled-hover': foundationVars.color.button.primary.hover,
    '--mantine-color-brand-light-color': foundationVars.color.text.accent
  },
  dark: {
    '--border-color': foundationVars.color.border.strong,
    '--mantine-color-text': foundationVars.color.text.primary,
    '--mantine-color-body': foundationVars.color.surface.canvas,
    '--mantine-color-default-border': foundationVars.color.border.strong,
    '--mantine-color-brand-filled': foundationVars.color.button.primary.background,
    '--mantine-color-brand-filled-hover': foundationVars.color.button.primary.hover,
    '--mantine-color-brand-light-color': foundationVars.color.text.accent
  }
})
