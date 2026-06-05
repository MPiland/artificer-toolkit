import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import type { StorybookConfig } from '@storybook/tanstack-react'
import { mergeConfig } from 'vite'

const config: StorybookConfig = {
  framework: {
    name: '@storybook/tanstack-react',
    options: {}
  },
  staticDirs: ['../public'],
  stories: [
    '../src/**/*.stories.@(ts|tsx)'
  ],
  addons: [
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-themes'),
    getAbsolutePath('@storybook/addon-vitest'),
    getAbsolutePath('@storybook/addon-mcp')
  ],
  viteFinal: async (config) => {
    const { default: storybookViteConfig } = await import('./vite.config.ts')
    return mergeConfig(config, storybookViteConfig)
  }
}

export default config

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)))
}
