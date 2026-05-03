import type { Meta, StoryObj } from '@storybook/react-vite'
import { authoringFormStoryCanvas } from '#forms'
import { CreatureForm } from '../components/CreatureForm'
import {
  beastMountFixture,
  companionFixture,
  creatureRuntimeFixture,
  masterCreatureResponseFixture,
  npcFixture,
  ownedCreatureResponseFixture,
  ownedMonsterFixture,
  summonFixture
} from '../creature.fixtures'

const meta = {
  title: 'Domains/Creatures/Form',
  component: CreatureForm,
  parameters: {
    docs: {
      description: {
        component: 'Phase 9.11 Creature authoring form using category-driven flows, node-runtime options, draft sidecar behavior, and locked-master copy affordances.'
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
} satisfies Meta<typeof CreatureForm>

export default meta

type Story = StoryObj<typeof meta>
const masterCreatureStoryResponse = masterCreatureResponseFixture!

export const CreateMonster: Story = {
  args: {
    mode: 'create',
    systemId: 'dnd-5e-srd',
    userId: 'user-1',
    initialCreature: {
      ...ownedMonsterFixture,
      id: 'new-creature',
      label: '',
      quote: '',
      description: '',
      actions: []
    },
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const EditMonster: Story = {
  args: {
    mode: 'edit',
    systemId: ownedMonsterFixture.systemId,
    userId: 'user-1',
    response: ownedCreatureResponseFixture,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const BeastMount: Story = {
  args: {
    mode: 'edit',
    systemId: beastMountFixture.systemId,
    userId: 'user-1',
    initialCreature: beastMountFixture,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const NpcPersonality: Story = {
  args: {
    mode: 'edit',
    systemId: npcFixture.systemId,
    userId: 'user-1',
    initialCreature: npcFixture,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const CompanionProfile: Story = {
  args: {
    mode: 'edit',
    systemId: companionFixture.systemId,
    userId: 'user-1',
    initialCreature: companionFixture,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const SummonProfile: Story = {
  args: {
    mode: 'edit',
    systemId: summonFixture.systemId,
    userId: 'user-1',
    initialCreature: summonFixture,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    mode: 'view',
    systemId: masterCreatureStoryResponse.item?.systemId ?? 'dnd5e2014',
    userId: 'user-1',
    response: masterCreatureStoryResponse,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined,
    onCopy: () => undefined
  }
}
