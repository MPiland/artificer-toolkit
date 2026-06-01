import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useMemo } from 'react'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  InvalidDraftAlert,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import {
  createClassRuntimeFixture,
  masterSubclassResponseFixture,
  ownedClassResponseFixture
} from '../class.fixtures'
import {
  createEmptyClass,
  toClassFormValues,
  type ClassFormValues
} from '../classAuthoring.utils'
import { ClassAuthoringRenderer } from '../components/ClassAuthoringRenderer'

const meta = {
  title: 'Domains/Classes/Form',
  component: ClassFormStoryHarness,
  parameters: {
    docs: {
      description: {
        component: 'Class authoring rendered from the shared node-driven form renderer. Category inside the form controls base class and subclass branches.'
      }
    }
  }
} satisfies Meta<typeof ClassFormStoryHarness>

export default meta

type Story = StoryObj<typeof meta>

export const EditBaseClass: Story = {
  args: {
    classRecord: toClassFormValues(ownedClassResponseFixture.item),
    readOnly: false
  }
}

export const CreateDraft: Story = {
  args: {
    classRecord: createEmptyClass({ systemId: 'system-5e' }),
    readOnly: false
  }
}

export const EditSubclass: Story = {
  args: {
    classRecord: toClassFormValues(masterSubclassResponseFixture.item),
    readOnly: false
  }
}

export const LockedSubclass: Story = {
  args: {
    classRecord: toClassFormValues(masterSubclassResponseFixture.item),
    readOnly: true
  }
}

export const InvalidDraftRecovery: Story = {
  args: {
    classRecord: toClassFormValues(ownedClassResponseFixture.item),
    readOnly: false,
    showInvalidDraft: true
  }
}

function ClassFormStoryHarness({
  classRecord,
  readOnly,
  showInvalidDraft = false
}: {
  classRecord: ClassFormValues
  readOnly: boolean
  showInvalidDraft?: boolean
}) {
  return (
    <AuthoringFormProvider>
      <ClassFormStoryInner
        classRecord={classRecord}
        readOnly={readOnly}
        showInvalidDraft={showInvalidDraft}
      />
    </AuthoringFormProvider>
  )
}

function ClassFormStoryInner({
  classRecord,
  readOnly,
  showInvalidDraft
}: {
  classRecord: ClassFormValues
  readOnly: boolean
  showInvalidDraft: boolean
}) {
  const form = useAppForm({
    defaultValues: classRecord,
    onSubmit: async () => undefined
  })
  const providedModel = useMemo(() => createClassRuntimeFixture(classRecord.category), [classRecord.category])

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Class',
    canCopy: readOnly,
    mapId: 'class',
    mode: readOnly ? 'view' : 'edit',
    providedModel,
    readOnly,
    resolveModel: false,
    subjectKindLabel: 'Class',
    subjectLabel: classRecord.label || 'Untitled Class',
    systemId: classRecord.systemId
  }), [
    classRecord.label,
    classRecord.systemId,
    providedModel,
    readOnly
  ])

  const actions = useMemo<AuthoringFormActionHandlers>(() => ({
    onActivate: () => form.handleSubmit(),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: () => undefined
  }), [form])

  useAuthoringFormRegistration(registration, actions)

  return (
    <form.AppForm>
      {showInvalidDraft
        ? (
            <InvalidDraftAlert
              domainLabel='class'
              isDiscarding={false}
              onDiscard={() => undefined}
            />
          )
        : null}
      <AuthoringFormLayout>
        <ClassAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}
