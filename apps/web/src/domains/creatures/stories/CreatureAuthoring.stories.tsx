import { useMemo } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type {
  CreatureAuthoringInputDto,
  CreatureAuthoredDto
} from '@artificer-toolkit/schema/subjects/creature'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  authoringFormStoryCanvas,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import {
  createEmptyCreature,
  normalizeCreatureForSubmit,
  toCreatureFormValues
} from '../creatureAuthoring.utils'
import { CreatureAuthoringRenderer } from '../components/CreatureAuthoringRenderer'
import {
  beastMountFixture,
  companionFixture,
  creatureRuntimeFixture,
  masterCreatureResponseFixture,
  npcFixture,
  ownedMonsterFixture,
  summonFixture
} from '../creature.fixtures'

interface CreatureAuthoringStoryProps {
  initialCreature?: CreatureAuthoringInputDto | CreatureAuthoredDto
  readOnly?: boolean
}

function CreatureAuthoringStory({
  initialCreature = createEmptyCreature({ systemId: 'dnd-5e-srd' }),
  readOnly = false
}: CreatureAuthoringStoryProps) {
  return (
    <AuthoringFormProvider>
      <CreatureAuthoringStoryContent initialCreature={initialCreature} readOnly={readOnly} />
    </AuthoringFormProvider>
  )
}

function CreatureAuthoringStoryContent({
  initialCreature,
  readOnly
}: Required<CreatureAuthoringStoryProps>) {
  const creature = toCreatureFormValues(initialCreature)
  const form = useAppForm({
    defaultValues: creature,
    onSubmit: async ({ value }) => {
      normalizeCreatureForSubmit(value)
    }
  })
  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Creature',
    canCopy: readOnly,
    canSaveDraft: !readOnly,
    hasActiveDraft: false,
    mapId: 'creature',
    mode: readOnly ? 'view' : 'edit',
    providedModel: creatureRuntimeFixture,
    readOnly,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Creature',
    subjectLabel: creature.label || 'Untitled Creature',
    systemId: creature.systemId
  }), [
    creature.label,
    creature.systemId,
    readOnly
  ])
  const actions = useMemo<AuthoringFormActionHandlers>(() => ({
    onActivate: () => form.handleSubmit(),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: readOnly ? () => undefined : undefined,
    onSaveDraft: readOnly ? undefined : () => undefined
  }), [
    form,
    readOnly
  ])

  useAuthoringFormRegistration(registration, actions)

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <CreatureAuthoringRenderer form={form} resolveModel={false} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

const meta = {
  title: 'Domains/Creatures/Authoring',
  component: CreatureAuthoringStory,
  parameters: {
    docs: {
      description: {
        component: 'Creature authoring rendered through the shared node-driven TanStack renderer.'
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
} satisfies Meta<typeof CreatureAuthoringStory>

export default meta

type Story = StoryObj<typeof meta>
const masterCreatureStoryResponse = masterCreatureResponseFixture

export const CreateMonster: Story = {}

export const EditMonster: Story = {
  args: {
    initialCreature: ownedMonsterFixture
  }
}

export const BeastMount: Story = {
  args: {
    initialCreature: beastMountFixture
  }
}

export const NpcPersonality: Story = {
  args: {
    initialCreature: npcFixture
  }
}

export const CompanionProfile: Story = {
  args: {
    initialCreature: companionFixture
  }
}

export const SummonProfile: Story = {
  args: {
    initialCreature: summonFixture
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    initialCreature: masterCreatureStoryResponse.item,
    readOnly: true
  }
}
