import type {
  Meta,
  StoryObj } from '@storybook/react-vite'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  authoringFormStoryCanvas,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration
} from '#forms'
import {
  equipmentRuntimeFixture,
  masterEquipmentResponseFixture,
  ownedEquipmentResponseFixture,
  ownedVariantEquipmentResponseFixture
} from '../equipment.fixtures'
import {
  createEmptyEquipment,
  toEquipmentFormValues,
  type EquipmentFormValues
} from '../equipmentAuthoring.utils'
import { EquipmentAuthoringRenderer } from '../components/EquipmentAuthoringRenderer'

type EquipmentAuthoringStoryArgs = {
  canCopy?: boolean
  equipment: EquipmentFormValues
  model?: NodeRuntimeResolveResponseDto
  readOnly?: boolean
}

function EquipmentAuthoringStoryHarness({
  canCopy = false,
  equipment,
  model = equipmentRuntimeFixture,
  readOnly = false
}: EquipmentAuthoringStoryArgs) {
  return (
    <AuthoringFormProvider>
      <EquipmentAuthoringStoryContent
        canCopy={canCopy}
        equipment={equipment}
        model={model}
        readOnly={readOnly}
      />
    </AuthoringFormProvider>
  )
}

function EquipmentAuthoringStoryContent({
  canCopy,
  equipment,
  model,
  readOnly
}: Required<EquipmentAuthoringStoryArgs>) {
  const form = useAppForm({
    defaultValues: equipment,
    onSubmit: async () => undefined
  })

  useAuthoringFormRegistration({
    activateLabel: 'Activate Equipment',
    canCopy,
    canSaveDraft: !readOnly,
    mapId: 'equipment',
    mode: readOnly ? 'view' : 'edit',
    providedModel: model,
    readOnly,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Equipment',
    subjectLabel: equipment.label || 'Untitled Equipment',
    systemId: equipment.systemId
  }, {
    onActivate: () => form.handleSubmit(),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: () => undefined,
    onSaveDraft: () => undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <EquipmentAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

const meta = {
  title: 'Domains/Equipment/Form',
  component: EquipmentAuthoringStoryHarness,
  parameters: {
    docs: {
      description: {
        component: 'Phase 9.10 Equipment authoring form using route-loader data, shared authored form layout, node-runtime options, draft sidecar behavior, and locked-master copy affordances.'
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
} satisfies Meta<typeof EquipmentAuthoringStoryHarness>

export default meta

type Story = StoryObj<typeof meta>

export const CreateBaseEquipment: Story = {
  args: {
    equipment: createEmptyEquipment({ systemId: 'system-5e' })
  }
}

export const EditBaseEquipment: Story = {
  args: {
    equipment: toEquipmentFormValues(ownedEquipmentResponseFixture.item)
  }
}

export const EditVariantEquipment: Story = {
  args: {
    equipment: toEquipmentFormValues(ownedVariantEquipmentResponseFixture.item)
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    canCopy: true,
    equipment: toEquipmentFormValues(masterEquipmentResponseFixture.item),
    readOnly: true
  }
}
