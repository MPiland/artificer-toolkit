import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { resolveFixtureNodeRuntime } from '#test/nodeRuntimeResolver'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { useAppForm } from '../app-form/AppForm'
import { AuthoringLayout } from '../layout/AuthoringLayout'
import { FormRenderer } from '../rendering/FormRenderer'

type FormValues = Record<string, unknown>

const Renderer = FormRenderer<FormValues>({ defaultValues: {} })
const paladinRoot = paladin as unknown as FormValues
const layOnHands = paladin.features?.find(({ label }) => label === 'Lay on Hands')
if (!layOnHands?.charges) throw new Error('Expected the Paladin Lay on Hands pool.')

afterEach(cleanup)

describe('Picking a resource pool in the authoring form (AUTHORING-21.1)', () => {
  it('lists the pools of the record by name and stores the picked pool id', async () => {
    const user = userEvent.setup()
    const values: FormValues = { cost: 1 }
    render(
      <TestRouterProvider>
        <ResourceUseHarness
          initialValues={values}
          model={await resolveFixtureNodeRuntime({
            mapId: 'resourceUse',
            values,
            ancestors: [paladinRoot]
          })}
        />
      </TestRouterProvider>
    )

    expect(screen.queryByRole('textbox', { name: /charge id/i })).toBeNull()
    await user.click(await screen.findByRole('combobox', { name: /resource pool/i }))
    expect(await screen.findByRole('option', { name: 'Divine Sense' })).toBeDefined()
    await user.click(await screen.findByRole('option', { name: 'Lay on Hands' }))

    await waitFor(() => expect(readFormValues().chargeId).toBe(layOnHands.charges?.id))
  }, 10_000)
})

function readFormValues(): FormValues {
  return JSON.parse(screen.getByTestId('form-values').textContent ?? '{}') as FormValues
}

function ResourceUseHarness({
  initialValues,
  model
}: {
  initialValues: FormValues
  model: NodeRuntimeResolveResponseDto
}) {
  const form = useAppForm({ defaultValues: initialValues, onSubmit: async () => undefined })

  return (
    <AuthoringLayout>
      <form.AppForm>
        <Renderer
          form={form}
          mapId={model.mapId}
          model={model}
          renderAllSteps
          resolveModel={false}
          updateAuthoringState={false}
        />
        <form.Subscribe selector={(state) => state.values}>
          {(values) => <pre data-testid='form-values'>{JSON.stringify(values)}</pre>}
        </form.Subscribe>
      </form.AppForm>
    </AuthoringLayout>
  )
}
