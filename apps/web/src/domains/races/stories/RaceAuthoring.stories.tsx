import { useMemo } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type {
  RaceAuthoringInputDto,
  RaceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
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
  createEmptyRace,
  normalizeRaceForSubmit,
  toRaceFormValues
} from '../raceAuthoring.utils'
import { RaceAuthoringRenderer } from '../components/RaceAuthoringRenderer'
import {
  masterRaceFixture,
  ownedBaseRaceFixture,
  ownedSubraceFixture,
  raceRuntimeFixture
} from '../race.fixtures'

interface RaceAuthoringStoryProps {
  initialRace?: RaceAuthoringInputDto | RaceAuthoredDto
  readOnly?: boolean
}

function RaceAuthoringStory({
  initialRace = createEmptyRace({ systemId: 'dnd-5e-srd' }),
  readOnly = false
}: RaceAuthoringStoryProps) {
  return (
    <AuthoringFormProvider>
      <RaceAuthoringStoryContent initialRace={initialRace} readOnly={readOnly} />
    </AuthoringFormProvider>
  )
}

function RaceAuthoringStoryContent({
  initialRace,
  readOnly
}: Required<RaceAuthoringStoryProps>) {
  const race = toRaceFormValues(initialRace)
  const form = useAppForm({
    defaultValues: race,
    onSubmit: async ({ value }) => {
      normalizeRaceForSubmit(value)
    }
  })
  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Race',
    canCopy: readOnly,
    canSaveDraft: !readOnly,
    hasActiveDraft: false,
    mapId: 'race',
    mode: readOnly ? 'view' : 'edit',
    providedModel: raceRuntimeFixture,
    readOnly,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Race',
    subjectLabel: race.label || 'Untitled Race',
    systemId: race.systemId
  }), [
    race.label,
    race.systemId,
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
        <RaceAuthoringRenderer form={form} resolveModel={false} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

const meta = {
  title: 'Domains/Races/Authoring',
  component: RaceAuthoringStory,
  parameters: {
    docs: {
      description: {
        component: 'Race authoring rendered through the shared node-driven TanStack renderer.'
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
} satisfies Meta<typeof RaceAuthoringStory>

export default meta

type Story = StoryObj<typeof meta>

export const CreateBaseRace: Story = {}

export const EditBaseRace: Story = {
  args: {
    initialRace: ownedBaseRaceFixture
  }
}

export const EditSubrace: Story = {
  args: {
    initialRace: ownedSubraceFixture
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    initialRace: masterRaceFixture,
    readOnly: true
  }
}
