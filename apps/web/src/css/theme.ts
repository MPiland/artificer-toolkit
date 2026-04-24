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
  radius: {
    xs: foundationVars.radius.sm,
    sm: foundationVars.radius.sm,
    md: foundationVars.radius.md,
    lg: foundationVars.radius.lg,
    xl: foundationVars.radius.xl
  },
  defaultRadius: 'lg',
  components: {
    Button: Button.extend({
      vars: (_theme, props) => {
        const isSecondary = props.variant === 'default'
        const button = isSecondary
          ? foundationVars.color.button.secondary
          : foundationVars.color.button.primary

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
  variables: {
    '--at-accent': foundationVars.color.accent.solid,
    '--at-accent-hover': foundationVars.color.accent.hover,
    '--at-accent-muted': foundationVars.color.accent.soft,
    '--at-accent-glow': foundationVars.color.accent.focus,
    '--at-accent-border': foundationVars.color.accent.border,
    '--at-button-primary-background': foundationVars.color.button.primary.background,
    '--at-button-primary-border': foundationVars.color.button.primary.border,
    '--at-button-primary-hover': foundationVars.color.button.primary.hover,
    '--at-button-primary-active': foundationVars.color.button.primary.active,
    '--at-button-primary-text': foundationVars.color.button.primary.text,
    '--at-button-secondary-background': foundationVars.color.button.secondary.background,
    '--at-button-secondary-border': foundationVars.color.button.secondary.border,
    '--at-button-secondary-hover': foundationVars.color.button.secondary.hover,
    '--at-button-secondary-active': foundationVars.color.button.secondary.active,
    '--at-button-secondary-text': foundationVars.color.button.secondary.text,
    '--at-red': foundationVars.color.status.danger,
    '--at-green': foundationVars.color.status.success,
    '--at-yellow': foundationVars.color.status.warning,
    '--at-teal': foundationVars.color.accent.solid,
    '--at-teal-hover': foundationVars.color.accent.hover,
    '--at-teal-muted': foundationVars.color.accent.soft,
    '--at-teal-glow': foundationVars.color.accent.focus,
    '--at-teal-border': foundationVars.color.accent.border
  },
  light: {
    '--border-color': foundationVars.color.border.strong,
    '--at-surface-0': foundationVars.color.surface.canvas,
    '--at-surface-1': foundationVars.color.surface.subtle,
    '--at-surface-2': foundationVars.color.surface.panel,
    '--at-surface-3': foundationVars.color.surface.raised,
    '--at-border': foundationVars.color.border.strong,
    '--at-border-subtle': foundationVars.color.border.subtle,
    '--at-text-primary': foundationVars.color.text.primary,
    '--at-text-secondary': foundationVars.color.text.secondary,
    '--at-text-muted': foundationVars.color.text.muted,
    '--at-shadow-card': foundationVars.shadow.card,
    '--at-shadow-card-hover': foundationVars.shadow.cardHover,
    '--at-shadow-teal': foundationVars.shadow.focus,
    '--mantine-color-text': foundationVars.color.text.primary,
    '--mantine-color-body': foundationVars.color.surface.canvas,
    '--mantine-color-default-border': foundationVars.color.border.strong,
    '--mantine-color-brand-filled': foundationVars.color.button.primary.background,
    '--mantine-color-brand-filled-hover': foundationVars.color.button.primary.hover,
    '--mantine-color-brand-light-color': foundationVars.color.text.accent
  },
  dark: {
    '--border-color': foundationVars.color.border.strong,
    '--at-surface-0': foundationVars.color.surface.canvas,
    '--at-surface-1': foundationVars.color.surface.subtle,
    '--at-surface-2': foundationVars.color.surface.panel,
    '--at-surface-3': foundationVars.color.surface.raised,
    '--at-border': foundationVars.color.border.strong,
    '--at-border-subtle': foundationVars.color.border.subtle,
    '--at-text-primary': foundationVars.color.text.primary,
    '--at-text-secondary': foundationVars.color.text.secondary,
    '--at-text-muted': foundationVars.color.text.muted,
    '--at-shadow-card': foundationVars.shadow.card,
    '--at-shadow-card-hover': foundationVars.shadow.cardHover,
    '--at-shadow-teal': foundationVars.shadow.focus,
    '--mantine-color-text': foundationVars.color.text.primary,
    '--mantine-color-body': foundationVars.color.surface.canvas,
    '--mantine-color-default-border': foundationVars.color.border.strong,
    '--mantine-color-brand-filled': foundationVars.color.button.primary.background,
    '--mantine-color-brand-filled-hover': foundationVars.color.button.primary.hover,
    '--mantine-color-brand-light-color': foundationVars.color.text.accent
  }
})
