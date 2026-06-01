import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration
} from '#forms'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  masterVehicleResponseFixture,
  ownedVehicleResponseFixture,
  vehicleRuntimeFixture
} from '../vehicle.fixtures'
import {
  toVehicleFormValues,
  type VehicleFormValues
} from '../vehicleAuthoring.utils'
import { VehicleAuthoringRenderer } from '../components/VehicleAuthoringRenderer'

const focusedWorkspaceRuntimeFixture = {
  mapId: 'vehicle',
  clearPaths: [],
  steps: [
    {
      id: 'content',
      label: 'Content',
      order: 10,
      sections: [
        {
          id: 'content',
          label: 'Content',
          order: 10,
          nodes: [
            groupNode('cost', ['cost'], 'Cost', 'OBJECT', 'cost'),
            groupNode('features', ['features'], 'Features', 'ARRAY', 'feature')
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

describe('VehicleAuthoringRenderer', () => {
  it('renders locked master view as read-only with duplicate affordance', () => {
    renderVehicleAuthoringHarness({
      canCopy: true,
      model: vehicleRuntimeFixture,
      readOnly: true,
      vehicle: toVehicleFormValues(masterVehicleResponseFixture.item)
    })

    expect(screen.getByText(/locked for direct editing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate to edit/i })).toBeEnabled()
    expect(screen.getAllByRole('textbox', { name: /name/i })[0]).toHaveAttribute('readonly')
  })

  it('renders the shared vehicle flow from resolved steps', async () => {
    const user = userEvent.setup()

    renderVehicleAuthoringHarness({
      model: vehicleRuntimeFixture,
      readOnly: false,
      vehicle: toVehicleFormValues(ownedVehicleResponseFixture.item)
    })

    expect(screen.getByRole('heading', { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stats/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('heading', { name: /stats/i })).toBeInTheDocument()
  })

  it('edits object groups through the shared focused workspace renderer', async () => {
    const user = userEvent.setup()

    renderVehicleAuthoringHarness({
      model: focusedWorkspaceRuntimeFixture,
      readOnly: false,
      vehicle: toVehicleFormValues(ownedVehicleResponseFixture.item)
    })

    await user.click(screen.getByRole('button', { name: /edit cost/i }))
    const costWorkspace = within(await screen.findByRole('region', { name: /vehicles .* cost/i }))
    const amountField = await costWorkspace.findByLabelText(/amount/i)
    await user.clear(amountField)
    await user.type(amountField, '7500')
    await user.click(costWorkspace.getByRole('button', { name: /close editor/i }))
    await user.click(screen.getByRole('button', { name: /edit cost/i }))

    expect(await screen.findByLabelText(/amount/i)).toHaveValue('7500')
  })

  it('adds and removes array groups through TanStack array fields in the focused workspace', async () => {
    const user = userEvent.setup()

    renderVehicleAuthoringHarness({
      model: focusedWorkspaceRuntimeFixture,
      readOnly: false,
      vehicle: toVehicleFormValues(ownedVehicleResponseFixture.item)
    })

    await user.click(screen.getByRole('button', { name: /add feature/i }))
    const featureWorkspace = within(await screen.findByRole('region', { name: /vehicles .* features .* feature 2/i }))
    expect(featureWorkspace.getByRole('heading', { level: 2, name: /features/i })).toBeInTheDocument()

    await user.click(featureWorkspace.getByRole('button', { name: /close editor/i }))

    expect(screen.getByRole('button', { name: /edit feature 2/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /remove feature 2/i }))

    expect(screen.queryByRole('button', { name: /edit feature 2/i })).not.toBeInTheDocument()
  })
})

function renderVehicleAuthoringHarness({
  canCopy = false,
  model,
  readOnly,
  vehicle
}: {
  canCopy?: boolean
  model: NodeRuntimeResolveResponseDto
  readOnly: boolean
  vehicle: VehicleFormValues
}) {
  return renderWithAppProviders(
    <AuthoringFormProvider>
      <VehicleAuthoringTestHarness
        canCopy={canCopy}
        model={model}
        readOnly={readOnly}
        vehicle={vehicle}
      />
    </AuthoringFormProvider>
  )
}

function VehicleAuthoringTestHarness({
  canCopy,
  model,
  readOnly,
  vehicle
}: {
  canCopy: boolean
  model: NodeRuntimeResolveResponseDto
  readOnly: boolean
  vehicle: VehicleFormValues
}) {
  const form = useAppForm({
    defaultValues: vehicle,
    onSubmit: async () => undefined
  })

  useAuthoringFormRegistration({
    activateLabel: 'Activate Vehicle',
    canCopy,
    mapId: 'vehicle',
    mode: readOnly ? 'view' : 'edit',
    providedModel: model,
    readOnly,
    resolveModel: false,
    subjectKindLabel: 'Vehicle',
    subjectLabel: vehicle.label || 'Untitled Vehicle',
    systemId: vehicle.systemId
  }, {
    onActivate: () => form.handleSubmit(),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: () => undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <VehicleAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

function groupNode(
  id: string,
  path: string[],
  label: string,
  groupKind: 'OBJECT' | 'ARRAY',
  childMapId: string
): NodeRuntimeResolveResponseDto['steps'][number]['sections'][number]['nodes'][number] {
  return {
    id,
    path,
    label,
    kind: 'GROUP',
    groupKind,
    childMapId,
    visible: true,
    required: false,
    clearPaths: []
  }
}
