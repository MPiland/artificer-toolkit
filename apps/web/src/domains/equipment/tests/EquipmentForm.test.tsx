import { screen } from '@testing-library/react'
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
  equipmentRuntimeFixture,
  ownedEquipmentResponseFixture,
  masterEquipmentResponseFixture,
  ownedVariantEquipmentResponseFixture
} from '../equipment.fixtures'
import {
  toEquipmentFormValues,
  type EquipmentFormValues
} from '../equipmentAuthoring.utils'
import { EquipmentAuthoringRenderer } from '../components/EquipmentAuthoringRenderer'

const variantRuntimeFixture = {
  ...equipmentRuntimeFixture,
  steps: equipmentRuntimeFixture.steps.filter((step) => step.id !== 'contents')
}

const modalRuntimeFixture = {
  mapId: 'equipment',
  clearPaths: [],
  steps: [
    {
      id: 'nested',
      label: 'Nested',
      order: 10,
      sections: [
        {
          id: 'nested',
          label: 'Nested',
          order: 10,
          nodes: [
            groupNode('weight', ['weight'], 'Weight', 'OBJECT', 'weight'),
            groupNode('features', ['features'], 'Features', 'ARRAY', 'feature')
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

describe('EquipmentAuthoringRenderer', () => {
  it('renders locked master view as read-only with duplicate affordance', () => {
    renderEquipmentAuthoringHarness({
      equipment: toEquipmentFormValues(masterEquipmentResponseFixture.item!),
      model: equipmentRuntimeFixture,
      readOnly: true,
      canCopy: true
    })

    expect(screen.getByText(/locked for direct editing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate to edit/i })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: /category/i })).toHaveAttribute('readonly')
  })

  it('uses variant flow without inventory and contents steps', async () => {
    const user = userEvent.setup()

    renderEquipmentAuthoringHarness({
      equipment: toEquipmentFormValues(ownedVariantEquipmentResponseFixture.item!),
      model: variantRuntimeFixture,
      readOnly: false
    })

    expect(screen.queryByRole('button', { name: /inventory/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /contents/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('heading', { level: 2, name: /cost and weight/i })).toBeInTheDocument()
  })

  it('edits object groups through the shared modal renderer', async () => {
    const user = userEvent.setup()

    renderEquipmentAuthoringHarness({
      equipment: toEquipmentFormValues(ownedEquipmentResponseFixture.item!),
      model: modalRuntimeFixture,
      readOnly: false
    })

    await user.click(screen.getByRole('button', { name: /edit weight/i }))
    const amountField = await screen.findByLabelText(/amount/i)
    await user.clear(amountField)
    await user.type(amountField, '22')
    await user.click(screen.getByRole('button', { name: /save/i }))
    await user.click(screen.getByRole('button', { name: /edit weight/i }))

    expect(await screen.findByLabelText(/amount/i)).toHaveValue('22')
  })

  it('adds and removes array groups through TanStack array fields', async () => {
    const user = userEvent.setup()

    renderEquipmentAuthoringHarness({
      equipment: toEquipmentFormValues(ownedEquipmentResponseFixture.item!),
      model: modalRuntimeFixture,
      readOnly: false
    })

    await user.click(screen.getByRole('button', { name: /add features/i }))
    expect(screen.getByRole('heading', { level: 2, name: /features/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(screen.getByRole('button', { name: /edit features 2/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /remove features 2/i }))

    expect(screen.queryByRole('button', { name: /edit features 2/i })).not.toBeInTheDocument()
  })
})

function renderEquipmentAuthoringHarness({
  canCopy = false,
  equipment,
  model,
  readOnly
}: {
  canCopy?: boolean
  equipment: EquipmentFormValues
  model: NodeRuntimeResolveResponseDto
  readOnly: boolean
}) {
  return renderWithAppProviders(
    <AuthoringFormProvider>
      <EquipmentAuthoringTestHarness
        canCopy={canCopy}
        equipment={equipment}
        model={model}
        readOnly={readOnly}
      />
    </AuthoringFormProvider>
  )
}

function EquipmentAuthoringTestHarness({
  canCopy,
  equipment,
  model,
  readOnly
}: {
  canCopy: boolean
  equipment: EquipmentFormValues
  model: NodeRuntimeResolveResponseDto
  readOnly: boolean
}) {
  const form = useAppForm({
    defaultValues: equipment,
    onSubmit: async () => undefined
  })

  useAuthoringFormRegistration({
    activateLabel: 'Activate Equipment',
    canCopy,
    mapId: 'equipment',
    mode: readOnly ? 'view' : 'edit',
    providedModel: model,
    readOnly,
    resolveModel: false,
    subjectKindLabel: 'Equipment',
    subjectLabel: equipment.label || 'Untitled Equipment',
    systemId: equipment.systemId
  }, {
    onActivate: () => form.handleSubmit(),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: () => undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <EquipmentAuthoringRenderer form={form} />
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
