import type { StorybookConfig } from '@storybook/tanstack-react'
import config from '../main.ts'

/**
 * Stories that read the seeded local deployment (D218, D221). Their preview keeps `convex/react`
 * real apart from write spies, so they live beside the props-only preview, which mocks it.
 */
const backendConfig: StorybookConfig = {
  ...config,
  staticDirs: ['../../public'],
  stories: ['../../src/**/*.backend.stories.@(ts|tsx)']
}

export default backendConfig
