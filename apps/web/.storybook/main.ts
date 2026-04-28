import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import type { StorybookConfig } from '@storybook/react-vite'
import { mergeConfig, type UserConfig } from 'vite'

const config: StorybookConfig = {
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {}
  },
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-themes')
  ],
  viteFinal: async (config) => {
    const { default: storybookViteConfig } = await import('./vite.config.ts')
    const mergedConfig = mergeConfig(config, storybookViteConfig)

    return {
      ...mergedConfig,
      plugins: removeTanStackStartPlugins(mergedConfig.plugins)
    }
  }
}

export default config

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)))
}

function removeTanStackStartPlugins(plugins: UserConfig['plugins']): UserConfig['plugins'] {
  return plugins?.flatMap((plugin) => {
    if (Array.isArray(plugin)) return removeTanStackStartPlugins(plugin) ?? []
    if (!plugin) return []

    return isNamedPlugin(plugin) && isTanStackAppPlugin(plugin.name)
      ? []
      : [plugin]
  })
}

function isNamedPlugin(plugin: unknown): plugin is { name: string } {
  return (
    typeof plugin === 'object'
    && plugin !== null
    && 'name' in plugin
    && typeof (plugin as { name?: unknown }).name === 'string'
  )
}

function isTanStackAppPlugin(name: string) {
  return (
    name.includes('tanstack-start')
    || name.includes('tanstack-router')
    || name.includes('tanstack:router')
    || name === 'start-client-tree-plugin'
  )
}
