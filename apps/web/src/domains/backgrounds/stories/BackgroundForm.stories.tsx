import type { Meta, StoryObj } from '@storybook/react-vite'
import { authoringFormStoryCanvas } from '#forms'
import { BackgroundForm } from '../components/BackgroundForm'
import {
  masterBackgroundResponseFixture,
  ownedBackgroundFixture,
  ownedBackgroundResponseFixture
} from '../background.fixtures'

const meta = {
  title: 'Domains/Backgrounds/Form',
  component: BackgroundForm,
  parameters: {
    docs: {
      description: {
        component: 'Phase 9.7 Background authoring form using the shared TanStack Form runtime, Background DTOs, locked-master mode, and node-runtime-backed nested editors.'
      }
    }
  },
  decorators: [
    (Story) => (
      <div className={authoringFormStoryCanvas}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof BackgroundForm>

export default meta

type Story = StoryObj<typeof meta>

export const Create: Story = {
  args: {
    mode: 'create',
    systemId: 'dnd-5e-srd',
    userId: 'user-1',
    initialBackground: {
      ...ownedBackgroundFixture,
      id: 'new-background',
      label: '',
      description: '',
      details: [],
      proficiencies: [],
      features: []
    },
    resolveRuntime: false,
    onSubmit: async () => undefined
  }
}

export const EditOwned: Story = {
  args: {
    mode: 'edit',
    systemId: ownedBackgroundResponseFixture.item.systemId,
    userId: 'user-1',
    response: ownedBackgroundResponseFixture,
    resolveRuntime: false,
    onSubmit: async () => undefined
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    mode: 'view',
    systemId: masterBackgroundResponseFixture.item.systemId,
    userId: 'user-1',
    response: masterBackgroundResponseFixture,
    resolveRuntime: false,
    onSubmit: async () => undefined,
    onCopy: () => undefined
  }
}
