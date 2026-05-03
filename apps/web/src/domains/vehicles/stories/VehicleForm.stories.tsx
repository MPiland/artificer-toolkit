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
  masterVehicleResponseFixture,
  ownedVehicleResponseFixture,
  vehicleRuntimeFixture
} from '../vehicle.fixtures'
import {
  createEmptyVehicle,
  toVehicleFormValues,
  type VehicleFormValues
} from '../vehicleAuthoring.utils'
import { VehicleAuthoringRenderer } from '../components/VehicleAuthoringRenderer'

type VehicleAuthoringStoryArgs = {
  canCopy?: boolean
  model?: NodeRuntimeResolveResponseDto
  readOnly?: boolean
  vehicle: VehicleFormValues
}

function VehicleAuthoringStoryHarness({
  canCopy = false,
  model = vehicleRuntimeFixture,
  readOnly = false,
  vehicle
}: VehicleAuthoringStoryArgs) {
  return (
    <AuthoringFormProvider>
      <VehicleAuthoringStoryContent
        canCopy={canCopy}
        model={model}
        readOnly={readOnly}
        vehicle={vehicle}
      />
    </AuthoringFormProvider>
  )
}

function VehicleAuthoringStoryContent({
  canCopy,
  model,
  readOnly,
  vehicle
}: Required<VehicleAuthoringStoryArgs>) {
  const form = useAppForm({
    defaultValues: vehicle,
    onSubmit: async () => undefined
  })

  useAuthoringFormRegistration({
    activateLabel: 'Activate Vehicle',
    canCopy,
    canSaveDraft: !readOnly,
    mapId: 'vehicle',
    mode: readOnly ? 'view' : 'edit',
    providedModel: model,
    readOnly,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Vehicle',
    subjectLabel: vehicle.label || 'Untitled Vehicle',
    systemId: vehicle.systemId
  }, {
    onActivate: () => form.handleSubmit(),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: () => undefined,
    onSaveDraft: () => undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <VehicleAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

const meta = {
  title: 'Domains/Vehicles/Form',
  component: VehicleAuthoringStoryHarness,
  parameters: {
    docs: {
      description: {
        component: 'Phase 9.12 Vehicle authoring form using route-loader data, shared authored form layout, node-runtime options, draft sidecar behavior, and locked-master copy affordances.'
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
} satisfies Meta<typeof VehicleAuthoringStoryHarness>

export default meta

type Story = StoryObj<typeof meta>

export const CreateVehicle: Story = {
  args: {
    vehicle: createEmptyVehicle({ systemId: 'system-5e' })
  }
}

export const EditVehicle: Story = {
  args: {
    vehicle: toVehicleFormValues(ownedVehicleResponseFixture.item)
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    canCopy: true,
    readOnly: true,
    vehicle: toVehicleFormValues(masterVehicleResponseFixture.item)
  }
}
