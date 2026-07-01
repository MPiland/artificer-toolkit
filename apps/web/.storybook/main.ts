import type { StorybookConfig } from '@storybook/tanstack-react'

const config: StorybookConfig = {
  framework: {
    name: '@storybook/tanstack-react',
    options: {}
  },
  staticDirs: ['../public'],
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-themes',
    '@storybook/addon-vitest',
    '@storybook/addon-mcp',
    '@chromatic-com/storybook'
  ]
}

export default config
