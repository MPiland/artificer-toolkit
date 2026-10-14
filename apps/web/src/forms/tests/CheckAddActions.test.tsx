import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { checkDcDtoSchema } from '@artificer-toolkit/schema/effects/check'
import { resolveFixtureNodeRuntime } from '#test/nodeRuntimeResolver'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { useAppForm } from '../app-form/AppForm'
import { AuthoringLayout } from '../layout/AuthoringLayout'
import { FormRenderer } from '../rendering/FormRenderer'

type FormValues = Record<string, unknown>

const CheckRenderer = FormRenderer<FormValues>({ defaultValues: {} })

afterEach(cleanup)

describe('Adding checks and check DCs in the authoring form', () => {
  it('adds an invocation check with a DC row', async () => {
    const user = userEvent.setup()
    const values = { kind: 'ACTION', triggerCode: 'CHECK' }
    render(
      <TestRouterProvider>
        <CheckHarness
          initialValues={values}
          model={await resolveFixtureNodeRuntime({ mapId: 'invocation', values })}
        />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('button', { name: /^add check$/i }))

    await waitFor(() => expect(readFormValues().check).toBeDefined())
    expect(checkDcDtoSchema.safeParse((readFormValues().check as FormValues).dc).success).toBe(true)
  }, 10_000)

  it('adds an actor relationship escape DC', async () => {
    const user = userEvent.setup()
    const values = { kind: 'ESCAPE_CHECK' }
    render(
      <TestRouterProvider>
        <CheckHarness
          initialValues={values}
          model={await resolveFixtureNodeRuntime({ mapId: 'actorRelationshipModule', values })}
        />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('button', { name: /^add escape dc$/i }))

    await waitFor(() => expect(checkDcDtoSchema.safeParse(readFormValues().dc).success).toBe(true))
  }, 10_000)
})

function readFormValues(): FormValues {
  return JSON.parse(screen.getByTestId('form-values').textContent ?? '{}') as FormValues
}

function CheckHarness({
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
        <CheckRenderer
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
