import type { Meta, StoryObj } from '@storybook/react-vite'
import { authoringFormStoryCanvas } from '#forms'
import { RaceForm } from '../components/RaceForm'
import {
  masterRaceResponseFixture,
  ownedBaseRaceFixture,
  ownedBaseRaceResponseFixture,
  ownedSubraceFixture,
  ownedSubraceResponseFixture,
  raceRuntimeFixture
} from '../race.fixtures'

const meta = {
  title: 'Domains/Races/Form',
  component: RaceForm,
  parameters: {
    docs: {
      description: {
        component: 'Phase 9.9 Race authoring form using separate base-race and subrace flows, shared authored form layout, node-runtime options, and draft-aware locked-master behavior.'
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
} satisfies Meta<typeof RaceForm>

export default meta

type Story = StoryObj<typeof meta>

export const CreateBaseRace: Story = {
  args: {
    mode: 'create',
    systemId: 'dnd-5e-srd',
    userId: 'user-1',
    initialRace: {
      ...ownedBaseRaceFixture,
      id: 'new-race',
      label: '',
      quote: '',
      description: '',
      details: [],
      features: []
    },
    resolveRuntime: false,
    runtimeModel: raceRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const EditBaseRace: Story = {
  args: {
    mode: 'edit',
    systemId: ownedBaseRaceFixture.systemId,
    userId: 'user-1',
    response: ownedBaseRaceResponseFixture,
    resolveRuntime: false,
    runtimeModel: raceRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const EditSubrace: Story = {
  args: {
    mode: 'edit',
    systemId: ownedSubraceFixture.systemId,
    userId: 'user-1',
    response: ownedSubraceResponseFixture,
    resolveRuntime: false,
    runtimeModel: raceRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    mode: 'view',
    systemId: masterRaceResponseFixture.item.systemId,
    userId: 'user-1',
    response: masterRaceResponseFixture,
    resolveRuntime: false,
    runtimeModel: raceRuntimeFixture,
    onSubmit: async () => undefined,
    onCopy: () => undefined
  }
}
