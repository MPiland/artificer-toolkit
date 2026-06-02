import { useMemo } from 'react'
import type {
  Meta,
  StoryObj
} from '@storybook/tanstack-react'
import type {
  SpellAuthoringInputDto,
  SpellAuthoredDto
} from '@artificer-toolkit/schema/subjects/spell'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  authoringFormStoryCanvas,
  clearResolvedNodeFormPaths,
  createDefaultEffect,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import {
  createEmptySpell,
  normalizeSpellForSubmit
} from '../spellAuthoring.utils'
import { SpellAuthoringRenderer } from '../components/SpellAuthoringRenderer'
import { spellFixture, spellReferenceFixture } from '../spellAuthoring.fixtures'

interface SpellAuthoringStoryProps {
  initialSpell?: SpellAuthoringInputDto | SpellAuthoredDto
  readOnly?: boolean
}

function SpellAuthoringStory({
  initialSpell = createEmptySpell({ systemId: spellReferenceFixture.systemId }),
  readOnly = false
}: SpellAuthoringStoryProps) {
  return (
    <AuthoringFormProvider>
      <SpellAuthoringStoryContent initialSpell={initialSpell} readOnly={readOnly} />
    </AuthoringFormProvider>
  )
}

function SpellAuthoringStoryContent({
  initialSpell,
  readOnly
}: Required<SpellAuthoringStoryProps>) {
  const form = useAppForm({
    defaultValues: initialSpell,
    onSubmit: async ({ value }) => {
      normalizeSpellForSubmit(value, spellReferenceFixture)
    }
  })
  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Spell',
    canCopy: readOnly,
    canSaveDraft: !readOnly,
    hasActiveDraft: false,
    mapId: 'spell',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Spell',
    subjectLabel: initialSpell.label || 'Untitled Spell',
    systemId: initialSpell.systemId
  }), [
    initialSpell.label,
    initialSpell.systemId,
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
        <SpellAuthoringRenderer form={form} resolveModel={false} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

const meta = {
  title: 'Domains/Spells/Authoring',
  component: SpellAuthoringStory,
  parameters: {
    docs: {
      description: {
        component: 'Spell authoring rendered through the shared node-driven TanStack renderer.'
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
} satisfies Meta<typeof SpellAuthoringStory>

export default meta

type Story = StoryObj<typeof meta>

export const Create: Story = {}

export const EditOwned: Story = {
  args: {
    initialSpell: {
      ...spellFixture,
      effects: [createDefaultEffect(1)]
    }
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    initialSpell: {
      ...spellFixture,
      id: 'spell-master-fire-lace',
      label: 'Master Fire Lace'
    },
    readOnly: true
  }
}
